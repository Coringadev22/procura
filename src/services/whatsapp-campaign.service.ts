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

// ============ TEMPLATES (5 categorias) ============

// 1.1 Empresas que licitam (pncp, pncp_contratos, sicaf, tce_sp, tce_rj)
const LICITANTES_V1 = `Oi, poderia me informar quem é o responsável pela área de licitações na empresa?

Sou Alvaro Gonzaga, advogado especializado em licitações e contratos públicos.`;

const LICITANTES_V2 = `Olá! Entramos em contato há alguns dias sobre assessoria jurídica em licitações.

Caso tenha interesse, oferecemos uma conversa breve e sem compromisso para avaliar como podemos ajudar a {empresa} a reduzir riscos e aumentar resultados em contratações públicas.

Fico à disposição. Abraço!

Alvaro Gonzaga`;

// 1.2 Empresas executadas / punidas (ceis, cnep)
const EXECUTADAS_V1 = `Oi, sou advogado e atuo na área de execuções fiscais empresariais.

Tenho auxiliado empresas a suspender bloqueios e discutir débitos. Vocês já possuem acompanhamento jurídico nessa área?`;

const EXECUTADAS_V2 = `Olá! Entramos em contato há alguns dias sobre defesa em execuções fiscais.

Se a {empresa} está enfrentando alguma situação de bloqueio ou penalidade, posso avaliar o caso sem compromisso.

Alvaro Gonzaga`;

// 1.3 PF respondendo PAD (diario_oficial com PAD)
const PAD_V1 = `Oi, sou advogado e atuo na defesa de servidores em Processos Administrativos Disciplinares.

Você já está acompanhando a situação?`;

const PAD_V2 = `Olá! Entramos em contato há alguns dias sobre defesa em PAD.

Se precisar de orientação jurídica sobre o processo, posso avaliar sua situação sem compromisso.

Alvaro Gonzaga`;

// 1.4 PF sendo executadas
const EXECUCAO_PF_V1 = `Oi, sou advogado e atuo na defesa em execuções judiciais, inclusive com possibilidade de revisão de valores e suspensão de bloqueios.

Você já está acompanhando sua situação?`;

const EXECUCAO_PF_V2 = `Olá! Entramos em contato há alguns dias sobre defesa em execuções judiciais.

Se precisar de orientação sobre revisão de valores ou suspensão de bloqueios, posso avaliar seu caso sem compromisso.

Alvaro Gonzaga`;

// 1.5 Contadores (parceria)
const CONTABILIDADE_V1 = `Aqui é o Alvaro, sou advogado, e queria saber se vocês já tem parceria com escritório de advocacia. Somos da área de licitações.`;

const CONTABILIDADE_V2 = `Olá! Entramos em contato há alguns dias sobre uma parceria para atender clientes que participam de licitações.

Muitos escritórios contábeis já indicam nossos serviços jurídicos como diferencial competitivo para seus clientes.

Se quiser saber como funciona, posso explicar rapidamente. Sem compromisso!

Alvaro Gonzaga`;

// ============ TEMPLATE SELECTION ============

/** Map lead to the correct template based on fonte and categoria */
export function getTemplateForLead(
  lead: { fonte: string | null; categoria: string; tipoPessoa: string | null },
  sequence: 1 | 2
): { name: string; body: string } {
  // Contabilidade always gets partnership template
  if (lead.categoria === "contabilidade") {
    return sequence === 1
      ? { name: "Contabilidade V1", body: CONTABILIDADE_V1 }
      : { name: "Contabilidade V2", body: CONTABILIDADE_V2 };
  }

  // PF leads from PAD
  if (lead.tipoPessoa === "PF" && lead.fonte === "diario_oficial") {
    return sequence === 1
      ? { name: "PAD V1", body: PAD_V1 }
      : { name: "PAD V2", body: PAD_V2 };
  }

  // Empresas executadas/punidas
  if (lead.fonte === "ceis" || lead.fonte === "cnep") {
    return sequence === 1
      ? { name: "Executadas V1", body: EXECUTADAS_V1 }
      : { name: "Executadas V2", body: EXECUTADAS_V2 };
  }

  // Default: empresas que licitam
  return sequence === 1
    ? { name: "Licitantes V1", body: LICITANTES_V1 }
    : { name: "Licitantes V2", body: LICITANTES_V2 };
}

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
        eq(leads.temWhatsapp, true),
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
      const tpl = getTemplateForLead(lead, 2);
      const success = await sendCampaignWhatsApp(lead, tpl.name, tpl.body, 2);

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
    // Get all V1 eligible leads (mobile, never WPP'd, email sent)
    const v1All = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.whatsappSentCount, 0),
          eq(leads.temWhatsapp, true),
          isNotNull(leads.telefones),
          sql`${leads.emailSentCount} >= 1`
        )
      )
      .limit(remainingBudget);

    logger.info(`WhatsApp V1: ${v1All.length} leads eligible (budget: ${remainingBudget})`);

    for (const lead of v1All) {
      if (remainingBudget <= 0) break;
      try {
        const tpl = getTemplateForLead(lead, 1);
        const success = await sendCampaignWhatsApp(lead, tpl.name, tpl.body, 1);
        if (success) {
          v1Sent++;
          remainingBudget--;
        } else {
          v1Failed++;
        }
      } catch (err: any) {
        logger.error(`WhatsApp V1 error for ${lead.cnpj}: ${err.message}`);
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
