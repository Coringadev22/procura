import { eq, and, isNotNull, sql, lte } from "drizzle-orm";
import { db } from "../config/database.js";
import { leads, whatsappSendLog } from "../db/schema.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { sendCampaignWhatsApp, isConnected } from "./whatsapp.service.js";

// ============ CONSTANTS ============

const DAILY_LIMIT = () => env.WHATSAPP_DAILY_LIMIT;
const EMPRESA_RATIO = 0.9;
const REMARKETING_DELAY_DAYS = 7;
const DELAY_BETWEEN_SENDS_MS = 3000; // 3 seconds (WhatsApp is stricter)

// ============ TEMPLATES ============

const EMPRESA_V1 = `Boa tarde! Sou Alvaro Gonzaga, advogado especializado em licitações e contratos públicos.

Vi que a {empresa} tem atuado no mercado de contratações públicas e gostaria de me colocar à disposição.

Nosso escritório atua em todo o Brasil oferecendo:
• Análise de editais e recursos administrativos
• Defesa em penalidades e impedimentos
• Reequilíbrio econômico-financeiro de contratos

Se fizer sentido para sua empresa, posso explicar brevemente como podemos contribuir.

www.alvarogonzaga.com.br

Responda SAIR para não receber mais mensagens.`;

const EMPRESA_V2 = `Olá! Entramos em contato há alguns dias sobre assessoria jurídica em licitações.

Caso tenha interesse, oferecemos uma conversa breve e sem compromisso para avaliar como podemos ajudar a {empresa} a reduzir riscos e aumentar resultados em contratações públicas.

Fico à disposição. Abraço!

Alvaro Gonzaga
www.alvarogonzaga.com.br

Responda SAIR para não receber mais mensagens.`;

const CONTABILIDADE_V1 = `Boa tarde! Sou Alvaro Gonzaga, advogado especializado em licitações e contratos públicos.

Trabalho com diversos escritórios de contabilidade que atendem empresas participantes de licitações. Gostaria de apresentar uma parceria que pode agregar valor aos seus clientes.

Nosso escritório oferece:
• Assessoria completa em licitações
• Defesa administrativa e judicial
• Análise de editais e contratos

Se tiver interesse em conhecer nossa proposta de parceria, fico à disposição para uma conversa breve.

www.alvarogonzaga.com.br

Responda SAIR para não receber mais mensagens.`;

const CONTABILIDADE_V2 = `Olá! Entramos em contato há alguns dias sobre uma parceria para atender clientes que participam de licitações.

Muitos escritórios contábeis já indicam nossos serviços jurídicos como diferencial competitivo para seus clientes.

Se quiser saber como funciona, posso explicar rapidamente. Sem compromisso!

Alvaro Gonzaga
www.alvarogonzaga.com.br

Responda SAIR para não receber mais mensagens.`;

// ============ CAMPAIGN RESULT ============

interface WhatsAppCampaignResult {
  sentToday: number;
  v1Sent: number;
  v2Sent: number;
  v1Failed: number;
  v2Failed: number;
  skipped: boolean;
  error?: string;
}

// ============ CAMPAIGN LOGIC ============

let isRunning = false;

export async function runDailyWhatsAppCampaign(): Promise<WhatsAppCampaignResult> {
  if (isRunning) {
    logger.warn("WhatsApp Campaign: Already running, skipping.");
    return { sentToday: 0, v1Sent: 0, v2Sent: 0, v1Failed: 0, v2Failed: 0, skipped: true };
  }

  isRunning = true;
  try {
    return await executeCampaign();
  } finally {
    isRunning = false;
  }
}

async function executeCampaign(): Promise<WhatsAppCampaignResult> {
  // Check if WhatsApp is connected
  const connected = await isConnected();
  if (!connected) {
    logger.warn("WhatsApp Campaign: Not connected, skipping.");
    return { sentToday: 0, v1Sent: 0, v2Sent: 0, v1Failed: 0, v2Failed: 0, skipped: true, error: "Not connected" };
  }

  const today = new Date().toISOString().split("T")[0];

  // Count WhatsApp messages sent today
  const todayCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(whatsappSendLog)
    .where(
      and(
        eq(whatsappSendLog.status, "sent"),
        sql`${whatsappSendLog.sentAt} LIKE ${today + "%"}`
      )
    );

  const sentToday = Number(todayCount[0]?.count ?? 0);
  let remainingBudget = DAILY_LIMIT() - sentToday;

  if (remainingBudget <= 0) {
    logger.info(`WhatsApp Campaign: Daily limit reached (${sentToday}/${DAILY_LIMIT()}). Skipping.`);
    return { sentToday, v1Sent: 0, v2Sent: 0, v1Failed: 0, v2Failed: 0, skipped: true };
  }

  let v1Sent = 0;
  let v2Sent = 0;
  let v1Failed = 0;
  let v2Failed = 0;

  // ---- FLOW 2: V2 REMARKETING (higher priority) ----
  const sevenDaysAgo = new Date(
    Date.now() - REMARKETING_DELAY_DAYS * 86_400_000
  ).toISOString();

  const v2Candidates = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.whatsappSentCount, 1),
        eq(leads.temCelular, true),
        isNotNull(leads.telefones),
        lte(leads.whatsappSentAt, sevenDaysAgo)
      )
    );

  logger.info(
    `WhatsApp Campaign: ${v2Candidates.length} leads eligible for V2 remarketing`
  );

  for (const lead of v2Candidates) {
    if (remainingBudget <= 0) break;

    try {
      const template = lead.categoria === "contabilidade" ? CONTABILIDADE_V2 : EMPRESA_V2;
      const tplName = lead.categoria === "contabilidade" ? "Contabilidade V2" : "Empresa V2";
      const success = await sendCampaignWhatsApp(lead, tplName, template, 2);

      if (success) {
        v2Sent++;
        remainingBudget--;
      } else {
        v2Failed++;
      }
    } catch (err: any) {
      logger.error(`WhatsApp V2 error for ${lead.cnpj}: ${err.message}`);
      v2Failed++;
    }

    if (remainingBudget > 0) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_SENDS_MS));
    }
  }

  // ---- FLOW 1: V1 FIRST CONTACT (remaining budget) ----
  if (remainingBudget > 0) {
    const empresaBudget = Math.floor(remainingBudget * EMPRESA_RATIO);
    const contabBudget = remainingBudget - empresaBudget;

    // Empresa V1: leads with mobile, never contacted via WhatsApp,
    // and emailSentCount >= 1 (already received email V1 at least)
    const v1Empresas = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.whatsappSentCount, 0),
          eq(leads.temCelular, true),
          eq(leads.categoria, "empresa"),
          isNotNull(leads.telefones),
          sql`${leads.emailSentCount} >= 1` // only after email V1
        )
      )
      .limit(empresaBudget);

    const v1Contabs = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.whatsappSentCount, 0),
          eq(leads.temCelular, true),
          eq(leads.categoria, "contabilidade"),
          isNotNull(leads.telefones),
          sql`${leads.emailSentCount} >= 1`
        )
      )
      .limit(contabBudget);

    logger.info(
      `WhatsApp V1: ${v1Empresas.length} empresas, ${v1Contabs.length} contabilidades (budget: ${empresaBudget}/${contabBudget})`
    );

    for (const lead of v1Empresas) {
      if (remainingBudget <= 0) break;
      try {
        const success = await sendCampaignWhatsApp(lead, "Empresa V1", EMPRESA_V1, 1);
        if (success) {
          v1Sent++;
          remainingBudget--;
        } else {
          v1Failed++;
        }
      } catch (err: any) {
        logger.error(`WhatsApp V1 empresa error for ${lead.cnpj}: ${err.message}`);
        v1Failed++;
      }
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_SENDS_MS));
    }

    for (const lead of v1Contabs) {
      if (remainingBudget <= 0) break;
      try {
        const success = await sendCampaignWhatsApp(lead, "Contabilidade V1", CONTABILIDADE_V1, 1);
        if (success) {
          v1Sent++;
          remainingBudget--;
        } else {
          v1Failed++;
        }
      } catch (err: any) {
        logger.error(`WhatsApp V1 contab error for ${lead.cnpj}: ${err.message}`);
        v1Failed++;
      }
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_SENDS_MS));
    }
  }

  const result: WhatsAppCampaignResult = {
    sentToday: sentToday + v1Sent + v2Sent,
    v1Sent,
    v2Sent,
    v1Failed,
    v2Failed,
    skipped: false,
  };

  logger.info(
    `WhatsApp Campaign completed: V1=${v1Sent} (${v1Failed} failed), V2=${v2Sent} (${v2Failed} failed), total today=${result.sentToday}/${DAILY_LIMIT()}`
  );

  return result;
}

// ============ SCHEDULER ============
// Runs daily at 14:00 BRT (Brasília, UTC-3 = 17:00 UTC)

let campaignTimer: ReturnType<typeof setTimeout> | null = null;

function msUntilNext2pmBRT(): number {
  const now = new Date();
  // Next 14:00 BRT = 17:00 UTC
  const target = new Date(now);
  target.setUTCHours(17, 0, 0, 0);
  if (now.getTime() >= target.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target.getTime() - now.getTime();
}

function scheduleNextRun(): void {
  const ms = msUntilNext2pmBRT();
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  logger.info(`Next WhatsApp campaign scheduled in ${hours}h ${mins}m (14:00 BRT)`);

  campaignTimer = setTimeout(async () => {
    try {
      await runDailyWhatsAppCampaign();
    } catch (err: any) {
      logger.error(`WhatsApp campaign scheduler error: ${err.message}`);
    }
    scheduleNextRun();
  }, ms);
}

export function startDailyWhatsAppScheduler(): void {
  scheduleNextRun();
  logger.info("Daily WhatsApp campaign scheduler started (runs at 14:00 BRT)");
}

export function stopDailyWhatsAppScheduler(): void {
  if (campaignTimer) {
    clearTimeout(campaignTimer);
    campaignTimer = null;
  }
}
