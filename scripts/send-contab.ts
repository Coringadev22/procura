import { db } from "../src/config/database.js";
import { leads, whatsappSendLog } from "../src/db/schema.js";
import { eq, and, sql, inArray } from "drizzle-orm";
import { parsePhoneList, isMobilePhone } from "../src/utils/phone.js";

const EVOLUTION_URL = "https://evolution-api-production-1d69.up.railway.app";
const EVOLUTION_KEY = "b121eb42081ae211e20207d6c9b9631c";
const INSTANCE = "Alvaro";

const MESSAGES: Record<string, string> = {
  contabilidade: `Aqui é o Alvaro, sou advogado, e queria saber se vocês já tem parceria com escritório de advocacia. Somos da área de licitações.`,
  licitantes: `Aqui é o Alvaro, sou advogado, e queria saber se já estão sendo atendidos. Nosso escritório atua com direito público: licitações, multas, processos administrativos, execução fiscal e toda essa área.`,
};

const LIMITS: Record<string, number> = {
  contabilidade: 2,
  pncp: 7,
  pncp_contratos: 7,
  diario_oficial: 7,
};

const DELAY_MS = 10 * 60 * 1000; // 10 minutes

async function sendWhatsApp(phone: string, text: string): Promise<boolean> {
  const number = phone.replace("+", "");
  const res = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: EVOLUTION_KEY },
    body: JSON.stringify({ number, text }),
  });
  return res.ok;
}

function getMessageForLead(lead: { categoria: string | null; fonte: string | null }): string {
  if (lead.categoria === "contabilidade") return MESSAGES.contabilidade;
  return MESSAGES.licitantes;
}

async function main() {
  // Check connection
  const stateRes = await fetch(`${EVOLUTION_URL}/instance/connectionState/${INSTANCE}`, {
    headers: { apikey: EVOLUTION_KEY },
  });
  const stateData = await stateRes.json() as any;
  if (stateData?.instance?.state !== "open") {
    console.log("WhatsApp nao conectado:", stateData?.instance?.state);
    process.exit(1);
  }
  console.log("WhatsApp conectado!\n");

  // Get ALL phones already sent (dedup)
  const allSent = await db.select({ phone: whatsappSendLog.recipientPhone }).from(whatsappSendLog);
  const alreadySentPhones = new Set(allSent.map(s => s.phone));
  console.log(`Telefones ja enviados no historico: ${alreadySentPhones.size}`);

  // Build send queue by category/fonte
  const queue: Array<{ lead: typeof leads.$inferSelect; phone: string; message: string; label: string }> = [];

  for (const [fonte, limit] of Object.entries(LIMITS)) {
    const isContab = fonte === "contabilidade";

    const candidates = await db.select().from(leads).where(
      and(
        isContab ? eq(leads.categoria, "contabilidade") : eq(leads.fonte, fonte),
        isContab ? sql`1=1` : sql`${leads.categoria} != 'contabilidade'`,
        eq(leads.temWhatsapp, true),
        eq(leads.whatsappSentCount, 0)
      )
    );

    let added = 0;
    for (const lead of candidates) {
      if (added >= limit) break;
      const phones = parsePhoneList(lead.telefones!);
      const mobile = phones.find(isMobilePhone) || phones[0];
      if (!mobile) continue;
      if (alreadySentPhones.has(mobile)) {
        // Mark as sent to avoid future attempts
        await db.update(leads).set({ whatsappSentCount: 1 }).where(eq(leads.id, lead.id));
        continue;
      }
      // Check queue itself for dups
      if (queue.some(q => q.phone === mobile)) continue;

      queue.push({
        lead,
        phone: mobile,
        message: getMessageForLead(lead),
        label: isContab ? "contabilidade" : fonte,
      });
      alreadySentPhones.add(mobile); // prevent dups within queue
      added++;
    }

    console.log(`${fonte}: ${added} de ${limit} adicionados (${candidates.length} candidatos)`);
  }

  console.log(`\n=== Fila de envio: ${queue.length} leads ===\n`);
  for (let i = 0; i < queue.length; i++) {
    const q = queue[i];
    console.log(`  ${i + 1}. [${q.label}] ${q.lead.razaoSocial || q.lead.cnpj} (${q.phone})`);
  }
  console.log(`\nMensagens:`);
  console.log(`  Contabilidade: "${MESSAGES.contabilidade}"`);
  console.log(`  Licitantes: "${MESSAGES.licitantes}"`);
  console.log(`\nIniciando envio...\n`);

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const { lead, phone, message, label } = queue[i];

    // Double-check DB right before sending
    const [alreadyLogged] = await db.select({ id: whatsappSendLog.id }).from(whatsappSendLog).where(
      eq(whatsappSendLog.recipientPhone, phone)
    );
    if (alreadyLogged) {
      console.log(`${i + 1}/${queue.length} [${label}] SKIP ${lead.razaoSocial || lead.cnpj} (${phone}) - ja enviado`);
      await db.update(leads).set({ whatsappSentCount: 1 }).where(eq(leads.id, lead.id));
      continue;
    }

    // Log BEFORE sending
    const [logEntry] = await db.insert(whatsappSendLog).values({
      leadId: lead.id,
      recipientPhone: phone,
      recipientCnpj: lead.cnpj,
      recipientName: lead.razaoSocial || null,
      templateName: label === "contabilidade" ? "Contabilidade Manual" : "Licitantes Manual",
      messageText: message,
      messageSequence: 1,
      status: "pending",
    }).returning({ id: whatsappSendLog.id });

    console.log(`${i + 1}/${queue.length} [${label}] Enviando para ${lead.razaoSocial || lead.cnpj} (${phone})...`);

    try {
      const ok = await sendWhatsApp(phone, message);
      if (ok) {
        await db.update(whatsappSendLog).set({ status: "sent" }).where(eq(whatsappSendLog.id, logEntry.id));
        await db.update(leads)
          .set({ whatsappSentCount: 1, whatsappSentAt: new Date().toISOString() })
          .where(eq(leads.id, lead.id));
        sent++;
        console.log(`  OK!`);
      } else {
        await db.update(whatsappSendLog).set({ status: "failed" }).where(eq(whatsappSendLog.id, logEntry.id));
        failed++;
        console.log(`  FALHOU`);
      }
    } catch (err: any) {
      await db.update(whatsappSendLog).set({ status: "failed", errorMessage: err.message }).where(eq(whatsappSendLog.id, logEntry.id));
      failed++;
      console.log(`  ERRO: ${err.message}`);
    }

    // Wait 10 minutes (except last)
    if (i < queue.length - 1) {
      const nextTime = new Date(Date.now() + DELAY_MS).toLocaleTimeString("pt-BR");
      console.log(`  Aguardando 10 min... proximo: ${nextTime}\n`);
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\nConcluido! Enviados: ${sent}, Falhas: ${failed}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
