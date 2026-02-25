import { eq, sql } from "drizzle-orm";
import { db } from "../config/database.js";
import { whatsappSendLog, leads } from "../db/schema.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { isValidBrazilianPhone } from "../utils/phone.js";

const instanceName = () => env.EVOLUTION_INSTANCE_NAME;
const baseUrl = () => env.EVOLUTION_API_URL || "";
const apiKey = () => env.EVOLUTION_API_KEY || "";

async function evoFetch(
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: unknown
): Promise<any> {
  const url = `${baseUrl()}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey(),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Evolution API ${method} ${path}: ${res.status} ${text}`);
  }

  return res.json();
}

/** Create WhatsApp instance if it doesn't exist */
export async function initializeInstance(): Promise<void> {
  if (!env.EVOLUTION_API_URL || !env.EVOLUTION_API_KEY) {
    logger.warn("WhatsApp: EVOLUTION_API_URL or EVOLUTION_API_KEY not set, skipping init");
    return;
  }

  try {
    // Check if instance already exists
    const state = await getConnectionState();
    logger.info(`WhatsApp instance "${instanceName()}" state: ${state}`);
    return;
  } catch {
    // Instance doesn't exist, create it
    logger.info(`Creating WhatsApp instance "${instanceName()}"...`);
  }

  try {
    await evoFetch("/instance/create", "POST", {
      instanceName: instanceName(),
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
    });
    logger.info(`WhatsApp instance "${instanceName()}" created. Scan QR code to connect.`);
  } catch (err: any) {
    logger.error(`WhatsApp init error: ${err.message}`);
  }
}

/** Get connection state: open, close, connecting */
export async function getConnectionState(): Promise<string> {
  const data = await evoFetch(`/instance/connectionState/${instanceName()}`);
  return data?.instance?.state || data?.state || "unknown";
}

/** Check if connected */
export async function isConnected(): Promise<boolean> {
  try {
    const state = await getConnectionState();
    return state === "open";
  } catch {
    return false;
  }
}

/** Get QR code for connecting */
export async function getQrCode(): Promise<{ qrcode?: string; base64?: string; state?: string }> {
  try {
    const data = await evoFetch(`/instance/connect/${instanceName()}`);
    return {
      qrcode: data?.qrcode?.code || data?.code,
      base64: data?.qrcode?.base64 || data?.base64,
      state: data?.state,
    };
  } catch (err: any) {
    return { state: "error" };
  }
}

/** Disconnect and logout */
export async function disconnectInstance(): Promise<void> {
  await evoFetch(`/instance/logout/${instanceName()}`, "DELETE");
}

/**
 * Check which phone numbers have WhatsApp accounts.
 * Uses Evolution API POST /chat/whatsappNumbers/{instance}
 * @returns Map of phone -> boolean (has WhatsApp)
 */
export async function checkWhatsAppNumbers(
  phones: string[]
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  if (phones.length === 0) return result;

  const numbers = phones.map((p) => p.replace("+", ""));

  try {
    const data = await evoFetch(
      `/chat/whatsappNumbers/${instanceName()}`,
      "POST",
      { numbers }
    );

    const items = Array.isArray(data)
      ? data
      : data?.response || data?.message || [];

    for (const item of items) {
      const num = item.number || item.jid?.replace("@s.whatsapp.net", "");
      if (!num) continue;
      const phone = num.startsWith("+") ? num : "+" + num;
      result.set(phone, item.exists === true);
    }
  } catch (err: any) {
    logger.error(`WhatsApp number check error: ${err.message}`);
  }

  return result;
}

/**
 * Check WhatsApp numbers in batches to avoid API limits.
 * @param batchSize How many per API call (default 50)
 */
export async function checkWhatsAppNumbersBatched(
  phones: string[],
  batchSize = 50
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();

  for (let i = 0; i < phones.length; i += batchSize) {
    const batch = phones.slice(i, i + batchSize);
    const batchResult = await checkWhatsAppNumbers(batch);
    for (const [phone, exists] of batchResult) {
      result.set(phone, exists);
    }
    if (i + batchSize < phones.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return result;
}

/** Send a text message via WhatsApp */
export async function sendWhatsAppMessage(
  phone: string,
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Ensure phone is a valid Brazilian phone (mobile or landline with WhatsApp)
  if (!isValidBrazilianPhone(phone)) {
    return { success: false, error: "Not a valid Brazilian phone number" };
  }

  // Remove + prefix for Evolution API (expects 5511999998888)
  const number = phone.replace("+", "");

  try {
    const data = await evoFetch(`/message/sendText/${instanceName()}`, "POST", {
      number,
      text,
    });

    const messageId = data?.key?.id || data?.messageId || null;
    return { success: true, messageId };
  } catch (err: any) {
    logger.error(`WhatsApp send error to ${phone}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/** Send a campaign WhatsApp message and log it */
export async function sendCampaignWhatsApp(
  lead: {
    id: number;
    telefones: string | null;
    cnpj: string;
    razaoSocial: string | null;
    nomeFantasia: string | null;
    municipio: string | null;
    uf: string | null;
    valorHomologado: number | null;
  },
  templateName: string,
  templateBody: string,
  sequence: number
): Promise<boolean> {
  if (!lead.telefones) return false;

  // Get first valid phone (mobile or landline with WhatsApp)
  const phones = lead.telefones.split(",").map((p) => p.trim());
  const validPhone = phones.find(isValidBrazilianPhone);
  if (!validPhone) return false;

  // Replace template variables
  const vars: Record<string, string> = {
    empresa: lead.razaoSocial || lead.nomeFantasia || "",
    cnpj: lead.cnpj,
    contato: lead.razaoSocial || "",
    valor: lead.valorHomologado
      ? `R$ ${lead.valorHomologado.toLocaleString("pt-BR")}`
      : "",
    cidade: lead.municipio || "",
    uf: lead.uf || "",
  };

  let messageText = templateBody;
  for (const [key, value] of Object.entries(vars)) {
    messageText = messageText.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }

  try {
    const result = await sendWhatsAppMessage(validPhone, messageText);

    // Log to database
    await db.insert(whatsappSendLog).values({
      leadId: lead.id,
      recipientPhone: validPhone,
      recipientCnpj: lead.cnpj,
      recipientName: lead.razaoSocial || lead.nomeFantasia || null,
      templateName,
      messageText,
      messageSequence: sequence,
      status: result.success ? "sent" : "failed",
      errorMessage: result.error || null,
      externalMessageId: result.messageId || null,
    });

    if (result.success) {
      // Update lead tracking
      await db.update(leads)
        .set({
          whatsappSentAt: new Date().toISOString(),
          whatsappSentCount: sql`${leads.whatsappSentCount} + 1`,
        })
        .where(eq(leads.id, lead.id));
    }

    return result.success;
  } catch (err: any) {
    logger.error(`WhatsApp campaign error for ${lead.cnpj}: ${err.message}`);

    try {
      await db.insert(whatsappSendLog).values({
        leadId: lead.id,
        recipientPhone: validPhone,
        recipientCnpj: lead.cnpj,
        recipientName: lead.razaoSocial || lead.nomeFantasia || null,
        templateName,
        messageText,
        messageSequence: sequence,
        status: "failed",
        errorMessage: err.message,
      });
    } catch {
      // ignore logging error
    }

    return false;
  }
}
