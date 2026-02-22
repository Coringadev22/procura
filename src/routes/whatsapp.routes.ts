import type { FastifyInstance } from "fastify";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../config/database.js";
import { leads, whatsappSendLog } from "../db/schema.js";
import { env } from "../config/env.js";
import {
  initializeInstance,
  isConnected,
  getQrCode,
  getConnectionState,
  sendWhatsAppMessage,
} from "../services/whatsapp.service.js";
import { runDailyWhatsAppCampaign } from "../services/whatsapp-campaign.service.js";
import { logger } from "../utils/logger.js";

export async function whatsappRoutes(app: FastifyInstance) {
  // Connection status
  app.get("/api/whatsapp/status", async () => {
    if (!env.EVOLUTION_API_URL) {
      return { enabled: false, message: "Evolution API not configured" };
    }

    try {
      const state = await getConnectionState();
      const connected = state === "open";

      const today = new Date().toISOString().split("T")[0];
      const todayCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(whatsappSendLog)
        .where(
          and(
            eq(whatsappSendLog.status, "sent"),
            sql`${whatsappSendLog.sentAt} LIKE ${today + "%"}`
          )
        );

      const totalLeadsWithPhone = await db
        .select({ count: sql<number>`count(*)` })
        .from(leads)
        .where(eq(leads.temCelular, true));

      return {
        enabled: true,
        connected,
        state,
        sentToday: Number(todayCount[0]?.count ?? 0),
        dailyLimit: env.WHATSAPP_DAILY_LIMIT,
        leadsWithMobile: Number(totalLeadsWithPhone[0]?.count ?? 0),
      };
    } catch (err: any) {
      return { enabled: true, connected: false, state: "error", error: err.message };
    }
  });

  // Get QR code for connecting
  app.get("/api/whatsapp/qr", async () => {
    if (!env.EVOLUTION_API_URL) {
      return { error: "Evolution API not configured" };
    }

    try {
      // Ensure instance exists
      await initializeInstance();
      const qr = await getQrCode();
      return qr;
    } catch (err: any) {
      return { error: err.message };
    }
  });

  // Send test message
  app.post<{
    Body: { phone: string; message?: string };
  }>("/api/whatsapp/send-test", async (request) => {
    const { phone, message } = request.body;
    if (!phone) return { error: "Phone number required" };

    const text = message || `Teste de envio WhatsApp - Procura\n${new Date().toLocaleString("pt-BR")}`;
    const result = await sendWhatsAppMessage(phone, text);
    return result;
  });

  // Campaign stats
  app.get("/api/whatsapp/campaign/stats", async () => {
    const today = new Date().toISOString().split("T")[0];

    // Total counts
    const [totals] = await db
      .select({
        sent: sql<number>`count(*) FILTER (WHERE ${whatsappSendLog.status} = 'sent')`,
        delivered: sql<number>`count(*) FILTER (WHERE ${whatsappSendLog.status} = 'delivered')`,
        read: sql<number>`count(*) FILTER (WHERE ${whatsappSendLog.readAt} IS NOT NULL)`,
        failed: sql<number>`count(*) FILTER (WHERE ${whatsappSendLog.status} = 'failed')`,
        sentToday: sql<number>`count(*) FILTER (WHERE ${whatsappSendLog.status} = 'sent' AND ${whatsappSendLog.sentAt} LIKE ${today + "%"})`,
      })
      .from(whatsappSendLog);

    const sent = Number(totals?.sent ?? 0);
    const delivered = Number(totals?.delivered ?? 0);
    const read = Number(totals?.read ?? 0);
    const failed = Number(totals?.failed ?? 0);

    // By sequence
    const bySeq = await db
      .select({
        sequence: whatsappSendLog.messageSequence,
        sent: sql<number>`count(*) FILTER (WHERE ${whatsappSendLog.status} = 'sent')`,
        delivered: sql<number>`count(*) FILTER (WHERE ${whatsappSendLog.status} = 'delivered')`,
        read: sql<number>`count(*) FILTER (WHERE ${whatsappSendLog.readAt} IS NOT NULL)`,
      })
      .from(whatsappSendLog)
      .groupBy(whatsappSendLog.messageSequence);

    const v1 = bySeq.find((r) => r.sequence === 1);
    const v2 = bySeq.find((r) => r.sequence === 2);

    return {
      totals: {
        sent,
        sentToday: Number(totals?.sentToday ?? 0),
        delivered,
        read,
        failed,
        deliveryRate: sent > 0 ? ((delivered / sent) * 100).toFixed(1) : "0.0",
        readRate: sent > 0 ? ((read / sent) * 100).toFixed(1) : "0.0",
      },
      bySequence: {
        v1: { sent: Number(v1?.sent ?? 0), delivered: Number(v1?.delivered ?? 0), read: Number(v1?.read ?? 0) },
        v2: { sent: Number(v2?.sent ?? 0), delivered: Number(v2?.delivered ?? 0), read: Number(v2?.read ?? 0) },
      },
      dailyLimit: env.WHATSAPP_DAILY_LIMIT,
      remainingToday: Math.max(0, env.WHATSAPP_DAILY_LIMIT - Number(totals?.sentToday ?? 0)),
    };
  });

  // Campaign pipeline
  app.get("/api/whatsapp/campaign/pipeline", async () => {
    const totalWithMobile = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.temCelular, true));

    const neverContacted = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(
        and(
          eq(leads.temCelular, true),
          eq(leads.whatsappSentCount, 0),
          sql`${leads.emailSentCount} >= 1`
        )
      );

    const waitingForV2 = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(
        and(
          eq(leads.temCelular, true),
          eq(leads.whatsappSentCount, 1)
        )
      );

    const fullyProcessed = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(
        and(
          eq(leads.temCelular, true),
          sql`${leads.whatsappSentCount} >= 2`
        )
      );

    return {
      totalWithMobile: Number(totalWithMobile[0]?.count ?? 0),
      eligibleForV1: Number(neverContacted[0]?.count ?? 0),
      waitingForV2: Number(waitingForV2[0]?.count ?? 0),
      fullyProcessed: Number(fullyProcessed[0]?.count ?? 0),
    };
  });

  // Trigger campaign manually
  app.post("/api/whatsapp/campaign/run", async (request, reply) => {
    runDailyWhatsAppCampaign().catch((err) =>
      logger.error(`Manual WhatsApp campaign error: ${err.message}`)
    );
    return { success: true, message: "Campanha WhatsApp iniciada" };
  });

  // Webhook from Evolution API (message status updates + incoming messages)
  app.post("/api/whatsapp/webhook", async (request) => {
    const body = request.body as any;
    const event = body?.event;

    if (!event) return { ok: true };

    try {
      // Message status updates
      if (event === "messages.update") {
        const updates = body?.data || [];
        for (const update of Array.isArray(updates) ? updates : [updates]) {
          const msgId = update?.key?.id;
          const status = update?.status;
          if (!msgId) continue;

          if (status === "DELIVERY_ACK" || status === "delivered") {
            await db.update(whatsappSendLog)
              .set({ status: "delivered", deliveredAt: new Date().toISOString() })
              .where(eq(whatsappSendLog.externalMessageId, msgId));
          } else if (status === "READ" || status === "read") {
            await db.update(whatsappSendLog)
              .set({ status: "delivered", readAt: new Date().toISOString() })
              .where(eq(whatsappSendLog.externalMessageId, msgId));
          }
        }
      }

      // Incoming messages (check for opt-out)
      if (event === "messages.upsert") {
        const messages = body?.data || [];
        for (const msg of Array.isArray(messages) ? messages : [messages]) {
          const text = (msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toUpperCase();
          const from = msg?.key?.remoteJid?.replace("@s.whatsapp.net", "") || "";

          if (["SAIR", "PARAR", "CANCELAR", "STOP"].includes(text) && from) {
            // Find lead by phone and mark as opted out (set whatsappSentCount = -1)
            const phone = from.startsWith("55") ? `+${from}` : `+55${from}`;
            const allLeads = await db.select().from(leads).where(eq(leads.temCelular, true));
            for (const lead of allLeads) {
              if (lead.telefones?.includes(phone)) {
                await db.update(leads)
                  .set({ whatsappSentCount: -1 }) // -1 = opted out
                  .where(eq(leads.id, lead.id));
                logger.info(`WhatsApp opt-out: ${lead.cnpj} (${phone})`);
                break;
              }
            }
          }
        }
      }
    } catch (err: any) {
      logger.error(`WhatsApp webhook error: ${err.message}`);
    }

    return { ok: true };
  });
}
