import { eq, and, sql, isNotNull, lte } from "drizzle-orm";
import { db } from "../config/database.js";
import { leads, emailSendLog, emailTemplates } from "../db/schema.js";
import { sendCampaignEmail } from "./resend.service.js";
import { logger } from "../utils/logger.js";

// ============ CONSTANTS ============

const DAILY_LIMIT = 100;
const EMPRESA_RATIO = 0.9;
const REMARKETING_DELAY_DAYS = 7;

// ============ TEMPLATE SEEDING ============

const EMPRESA_V1_HTML = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.7">
<p>Tenho acompanhado o crescimento de empresas que atuam no mercado de contratações públicas e sei o quanto a participação em licitações exige organização, estratégia e precisão técnica. Muitas empresas já possuem equipe interna estruturada — e ainda assim, acabam enfrentando desclassificações, recursos inesperados, impugnações ou dificuldades contratuais que poderiam ser prevenidas com um suporte jurídico mais direcionado.</p>
<p><strong>É exatamente nesse ponto que atuamos.</strong></p>
<p>Nosso escritório é especializado na assessoria jurídica estratégica para empresas que disputam licitações e executam contratos administrativos. Nosso foco não é substituir o setor interno, mas atuar como parceiro técnico, oferecendo respaldo jurídico preventivo e contencioso para:</p>
<ul style="color:#444;padding-left:20px">
<li>Análise prévia de editais e identificação de riscos</li>
<li>Estratégia jurídica em fases de habilitação e julgamento</li>
<li>Elaboração e defesa em recursos administrativos</li>
<li>Atuação em casos de penalidades, multas e impedimentos</li>
<li>Reequilíbrio econômico-financeiro e gestão contratual</li>
<li>Apoio jurídico contínuo para ampliar segurança e competitividade</li>
</ul>
<p>Na prática, nosso trabalho busca reduzir perdas evitáveis, aumentar taxas de êxito e proteger a margem de lucro dos contratos públicos.</p>
<p>Mais do que uma atuação pontual, propomos uma <strong>parceria estratégica</strong> voltada à expansão segura dos negócios. Atuamos em todo o Brasil.</p>
<p>Se fizer sentido para sua empresa, para nós será um prazer ouvir suas necessidades e quem sabe em uma conversa breve, sem compromisso, entendermos como podemos contribuir de forma objetiva para seus resultados.</p>
<p>Atenciosamente,<br><strong>Álvaro Gonzaga</strong></p>
<p><a href="https://www.alvarogonzaga.com.br" style="color:#3b82f6">www.alvarogonzaga.com.br</a></p>
</div>`;

const EMPRESA_V2_HTML = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.7">
<p>Atuar no mercado de licitações exige cada vez mais precisão técnica e estratégia jurídica. Mesmo empresas com setor interno estruturado podem perder oportunidades ou margem de lucro por questões formais, recursos inesperados ou riscos contratuais que poderiam ser prevenidos.</p>
<p><strong>É exatamente nesse ponto que atuamos.</strong></p>
<p>Nosso escritório é especializado em Direito Público e presta assessoria estratégica para empresas em todo o Brasil, que disputam licitações e executam contratos administrativos. Trabalhamos como parceiro técnico da sua equipe, oferecendo suporte em:</p>
<ul style="color:#444;padding-left:20px">
<li>Análise de editais e identificação de riscos</li>
<li>Estratégia jurídica nas fases de habilitação e julgamento</li>
<li>Recursos administrativos e defesa em penalidades</li>
<li>Reequilíbrio econômico-financeiro e gestão contratual</li>
</ul>
<p>Nosso foco é transformar <strong>segurança jurídica em vantagem competitiva</strong> — reduzindo perdas evitáveis e fortalecendo a atuação da empresa no setor público.</p>
<p>Se fizer sentido para sua estrutura, fico à disposição para uma conversa breve e sem compromisso, para avaliarmos como podemos contribuir de forma objetiva para seus resultados.</p>
<p>Atenciosamente,<br><strong>Álvaro Gonzaga</strong></p>
<p><a href="https://www.alvarogonzaga.com.br" style="color:#3b82f6">www.alvarogonzaga.com.br</a></p>
</div>`;

const CONTABILIDADE_V1_HTML = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.7">
<p>Sabemos que o escritório contábil é, muitas vezes, o primeiro a ser procurado quando o cliente enfrenta um problema — inclusive situações que extrapolam a esfera contábil.</p>
<p>Empresas que participam de licitações ou mantêm contratos com o poder público frequentemente enfrentam desafios como aplicação de multas administrativas, risco de impedimento para licitar, questionamentos em Tribunais de Contas, desequilíbrio econômico-financeiro de contratos ou até rescisões unilaterais. Nesses momentos, o cliente naturalmente recorre ao contador de confiança em busca de orientação.</p>
<p><strong>É justamente para dar suporte nessas situações que colocamos nosso escritório à disposição como parceiro técnico.</strong></p>
<p>Atuamos exclusivamente em Direito Público Empresarial, assessorando empresas em licitações, contratos administrativos e defesas perante órgãos de controle. Nosso objetivo é complementar o trabalho da contabilidade, oferecendo respaldo jurídico seguro quando a demanda ultrapassa a esfera contábil — preservando a relação do escritório com o cliente e fortalecendo a solução apresentada.</p>
<p>A parceria permite que o escritório contábil:</p>
<ul style="color:#444;padding-left:20px">
<li>Ofereça uma solução completa ao cliente</li>
<li>Reduza riscos de orientação em matéria jurídica sensível</li>
<li>Preserve e fortaleça a confiança do empresário</li>
<li>Conte com suporte técnico especializado sempre que necessário</li>
</ul>
<p>Atuamos em todo o Brasil, com atendimento estruturado e ágil, inclusive em reuniões conjuntas quando conveniente.</p>
<p>Se fizer sentido para o seu escritório, será um prazer conversarmos brevemente para entender o perfil dos seus clientes e apresentar como podemos estruturar essa parceria de forma profissional e segura para todos.</p>
<p>Fico à disposição.</p>
<p>Atenciosamente,<br><strong>Álvaro Gonzaga</strong></p>
<p><a href="https://www.alvarogonzaga.com.br" style="color:#3b82f6">www.alvarogonzaga.com.br</a></p>
</div>`;

const CONTABILIDADE_V2_HTML = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.7">
<p>Prezados,</p>
<p>Muitos empresários recorrem primeiro ao contador quando enfrentam multas administrativas, riscos em licitações, questionamentos de Tribunais de Contas ou problemas em contratos públicos. Nem sempre, porém, essas situações são apenas contábeis — e a ausência de suporte jurídico especializado pode aumentar o risco para o cliente.</p>
<p>Nosso escritório atua exclusivamente em <strong>Direito Público Empresarial</strong>, assessorando empresas em licitações, defesas administrativas e gestão de contratos com o poder público. A proposta é simples: sermos o suporte jurídico técnico do seu escritório sempre que a demanda exigir atuação especializada.</p>
<p>Assim, o cliente recebe uma solução completa, o escritório preserva sua relação de confiança e todos atuam com mais segurança.</p>
<p>Atuamos em todo o Brasil e podemos estruturar uma parceria técnica sob medida para o perfil dos seus clientes.</p>
<p>Se fizer sentido, fico à disposição para uma conversa breve e objetiva.</p>
<p>Atenciosamente,<br><strong>Álvaro Gonzaga</strong></p>
<p><a href="https://www.alvarogonzaga.com.br" style="color:#3b82f6">www.alvarogonzaga.com.br</a></p>
</div>`;

export async function seedCampaignTemplates(): Promise<void> {
  const existing = await db.select().from(emailTemplates);
  const existingNames = new Set(existing.map((t) => t.name));

  const campaignTemplates = [
    {
      name: "Empresa V1",
      subject:
        "Parceria jurídica estratégica para ampliar seus resultados em licitações",
      body: EMPRESA_V1_HTML,
      targetCategory: "empresa",
    },
    {
      name: "Empresa V2",
      subject:
        "Mais segurança jurídica para ampliar seus resultados em licitações",
      body: EMPRESA_V2_HTML,
      targetCategory: "empresa",
    },
    {
      name: "Contabilidade V1",
      subject:
        "Parceria estratégica para oferecer mais segurança jurídica aos seus clientes",
      body: CONTABILIDADE_V1_HTML,
      targetCategory: "contabilidade",
    },
    {
      name: "Contabilidade V2",
      subject:
        "Suporte jurídico estratégico para fortalecer seus clientes empresariais",
      body: CONTABILIDADE_V2_HTML,
      targetCategory: "contabilidade",
    },
  ];

  for (const tpl of campaignTemplates) {
    if (!existingNames.has(tpl.name)) {
      await db.insert(emailTemplates).values({
        ...tpl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      logger.info(`Seeded campaign template: ${tpl.name}`);
    }
  }
}

// ============ CAMPAIGN LOGIC ============

interface CampaignResult {
  sentToday: number;
  v1Sent: number;
  v2Sent: number;
  v1Failed: number;
  v2Failed: number;
  skipped: boolean;
  error?: string;
}

let isRunning = false;

export async function runDailyEmailCampaign(): Promise<CampaignResult> {
  if (isRunning) {
    logger.warn("Campaign: Already running, skipping.");
    return {
      sentToday: 0,
      v1Sent: 0,
      v2Sent: 0,
      v1Failed: 0,
      v2Failed: 0,
      skipped: true,
    };
  }

  isRunning = true;
  try {
    return await executeCampaign();
  } finally {
    isRunning = false;
  }
}

async function executeCampaign(): Promise<CampaignResult> {
  const today = new Date().toISOString().split("T")[0];

  // Count emails sent today
  const todayCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(emailSendLog)
    .where(
      and(
        eq(emailSendLog.status, "sent"),
        sql`${emailSendLog.sentAt} LIKE ${today + "%"}`
      )
    );

  const sentToday = Number(todayCount[0]?.count ?? 0);
  let remainingBudget = DAILY_LIMIT - sentToday;

  if (remainingBudget <= 0) {
    logger.info(
      `Campaign: Daily limit reached (${sentToday}/${DAILY_LIMIT}). Skipping.`
    );
    return {
      sentToday,
      v1Sent: 0,
      v2Sent: 0,
      v1Failed: 0,
      v2Failed: 0,
      skipped: true,
    };
  }

  // Load the 4 campaign templates
  const templates = await db.select().from(emailTemplates);
  const empresaV1 = templates.find((t) => t.name === "Empresa V1");
  const empresaV2 = templates.find((t) => t.name === "Empresa V2");
  const contabV1 = templates.find((t) => t.name === "Contabilidade V1");
  const contabV2 = templates.find((t) => t.name === "Contabilidade V2");

  if (!empresaV1 || !empresaV2 || !contabV1 || !contabV2) {
    logger.error(
      "Campaign: Missing templates. Need Empresa V1/V2 and Contabilidade V1/V2."
    );
    return {
      sentToday,
      v1Sent: 0,
      v2Sent: 0,
      v1Failed: 0,
      v2Failed: 0,
      skipped: true,
      error: "Missing templates",
    };
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
        eq(leads.emailSentCount, 1),
        isNotNull(leads.email),
        lte(leads.emailSentAt, sevenDaysAgo)
      )
    );

  logger.info(
    `Campaign: ${v2Candidates.length} leads eligible for V2 remarketing`
  );

  for (const lead of v2Candidates) {
    if (remainingBudget <= 0) break;

    const template =
      lead.categoria === "contabilidade" ? contabV2 : empresaV2;
    const success = await sendCampaignEmail(lead, template, 2);

    if (success) {
      v2Sent++;
      remainingBudget--;
    } else {
      v2Failed++;
    }

    // 1 second delay between sends
    if (remainingBudget > 0) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // ---- FLOW 1: V1 FIRST CONTACT (remaining budget) ----
  if (remainingBudget > 0) {
    const empresaBudget = Math.floor(remainingBudget * EMPRESA_RATIO);
    const contabBudget = remainingBudget - empresaBudget;

    // Empresa V1 candidates
    const v1Empresas = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.emailSentCount, 0),
          eq(leads.categoria, "empresa"),
          isNotNull(leads.email)
        )
      )
      .limit(empresaBudget);

    // Contabilidade V1 candidates
    const v1Contabs = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.emailSentCount, 0),
          eq(leads.categoria, "contabilidade"),
          isNotNull(leads.email)
        )
      )
      .limit(contabBudget);

    logger.info(
      `Campaign V1: ${v1Empresas.length} empresas, ${v1Contabs.length} contabilidades (budget: ${empresaBudget}/${contabBudget})`
    );

    for (const lead of v1Empresas) {
      if (remainingBudget <= 0) break;
      const success = await sendCampaignEmail(lead, empresaV1, 1);
      if (success) {
        v1Sent++;
        remainingBudget--;
      } else {
        v1Failed++;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    for (const lead of v1Contabs) {
      if (remainingBudget <= 0) break;
      const success = await sendCampaignEmail(lead, contabV1, 1);
      if (success) {
        v1Sent++;
        remainingBudget--;
      } else {
        v1Failed++;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const result: CampaignResult = {
    sentToday: sentToday + v1Sent + v2Sent,
    v1Sent,
    v2Sent,
    v1Failed,
    v2Failed,
    skipped: false,
  };

  logger.info(
    `Campaign completed: V1=${v1Sent} (${v1Failed} failed), V2=${v2Sent} (${v2Failed} failed), total today=${result.sentToday}/${DAILY_LIMIT}`
  );

  return result;
}

// ============ SCHEDULER ============
// Runs daily at 09:00 BRT (Brasília, UTC-3 = 12:00 UTC)

let campaignTimer: ReturnType<typeof setTimeout> | null = null;

function msUntilNext9amBRT(): number {
  const now = new Date();
  // Next 9:00 BRT = 12:00 UTC
  const target = new Date(now);
  target.setUTCHours(12, 0, 0, 0);
  // If already past 12:00 UTC today, schedule for tomorrow
  if (now.getTime() >= target.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target.getTime() - now.getTime();
}

function scheduleNextRun(): void {
  const ms = msUntilNext9amBRT();
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  logger.info(`Next campaign scheduled in ${hours}h ${mins}m (09:00 BRT)`);

  campaignTimer = setTimeout(async () => {
    try {
      await runDailyEmailCampaign();
    } catch (err: any) {
      logger.error(`Campaign scheduler error: ${err.message}`);
    }
    // After running, schedule the next day
    scheduleNextRun();
  }, ms);
}

export function startDailyCampaignScheduler(): void {
  scheduleNextRun();
  logger.info("Daily email campaign scheduler started (runs at 09:00 BRT)");
}

export function stopDailyCampaignScheduler(): void {
  if (campaignTimer) {
    clearTimeout(campaignTimer);
    campaignTimer = null;
  }
}
