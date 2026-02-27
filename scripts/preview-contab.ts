import { db } from "../src/config/database.js";
import { leads, whatsappSendLog } from "../src/db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { parsePhoneList, isMobilePhone } from "../src/utils/phone.js";

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

function getMessageForLead(lead: { categoria: string | null }): { key: string; msg: string } {
  if (lead.categoria === "contabilidade") return { key: "CONTABILIDADE", msg: MESSAGES.contabilidade };
  return { key: "LICITANTES", msg: MESSAGES.licitantes };
}

async function main() {
  const allSent = await db.select({ phone: whatsappSendLog.recipientPhone }).from(whatsappSendLog);
  const alreadySentPhones = new Set(allSent.map(s => s.phone));
  console.log(`Telefones ja enviados no historico: ${alreadySentPhones.size}\n`);

  const queue: Array<{ nome: string; phone: string; fonte: string; categoria: string; msgKey: string }> = [];

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
    let skipped = 0;
    for (const lead of candidates) {
      if (added >= limit) break;
      const phones = parsePhoneList(lead.telefones!);
      const mobile = phones.find(isMobilePhone) || phones[0];
      if (!mobile) continue;
      if (alreadySentPhones.has(mobile)) { skipped++; continue; }
      if (queue.some(q => q.phone === mobile)) continue;

      const { key } = getMessageForLead(lead);
      queue.push({
        nome: lead.razaoSocial || lead.cnpj,
        phone: mobile,
        fonte: fonte,
        categoria: lead.categoria || "",
        msgKey: key,
      });
      alreadySentPhones.add(mobile);
      added++;
    }
    console.log(`${fonte}: ${added} para enviar (${skipped} pulados por ja enviado)`);
  }

  console.log(`\n=== Fila: ${queue.length} leads ===\n`);
  for (let i = 0; i < queue.length; i++) {
    const q = queue[i];
    console.log(`  ${i + 1}. [${q.fonte}] [MSG: ${q.msgKey}] ${q.nome} (${q.phone})`);
  }

  console.log(`\n=== Mensagens ===`);
  console.log(`\n  CONTABILIDADE:`);
  console.log(`  "${MESSAGES.contabilidade}"`);
  console.log(`\n  LICITANTES (pncp, pncp_contratos, diario_oficial):`);
  console.log(`  "${MESSAGES.licitantes}"`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
