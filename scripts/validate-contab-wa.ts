import { db } from "../src/config/database.js";
import { leads } from "../src/db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { parsePhoneList } from "../src/utils/phone.js";

const EVOLUTION_URL = "https://evolution-api-production-1d69.up.railway.app";
const EVOLUTION_KEY = "b121eb42081ae211e20207d6c9b9631c";
const INSTANCE = "Alvaro";

async function checkWhatsApp(phones: string[]): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  const numbers = phones.map(p => p.replace("+", ""));

  try {
    const res = await fetch(`${EVOLUTION_URL}/chat/whatsappNumbers/${INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_KEY },
      body: JSON.stringify({ numbers }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as any[];
    for (const item of data) {
      const num = item.jid?.replace("@s.whatsapp.net", "") || "";
      const phone = phones.find(p => p.replace("+", "") === num || p.replace("+55", "") === num.replace("55", ""));
      if (phone) results.set(phone, item.exists === true);
    }
  } catch (err: any) {
    console.log(`Erro na validacao: ${err.message}`);
  }

  return results;
}

async function main() {
  // Check connection
  const stateRes = await fetch(`${EVOLUTION_URL}/instance/connectionState/${INSTANCE}`, {
    headers: { apikey: EVOLUTION_KEY },
  });
  const stateData = await stateRes.json() as any;
  if (stateData?.instance?.state !== "open") {
    console.log("WhatsApp nao conectado:", stateData);
    process.exit(1);
  }
  console.log("WhatsApp conectado!\n");

  const needsWA = await db.select().from(leads).where(
    and(
      eq(leads.categoria, "contabilidade"),
      eq(leads.temWhatsapp, false),
      sql`${leads.telefones} IS NOT NULL AND ${leads.telefones} != ''`
    )
  );

  console.log(`Contabilidades com telefone sem WA validado: ${needsWA.length}`);

  if (needsWA.length === 0) {
    console.log("Nada a validar.");
    process.exit(0);
  }

  const leadPhoneMap = new Map<string, number[]>();
  for (const lead of needsWA) {
    const phones = parsePhoneList(lead.telefones!);
    for (const phone of phones) {
      const existing = leadPhoneMap.get(phone) || [];
      existing.push(lead.id);
      leadPhoneMap.set(phone, existing);
    }
  }

  const allPhones = [...leadPhoneMap.keys()];
  console.log(`Telefones unicos: ${allPhones.length}\n`);

  // Batch of 50
  const waResults = new Map<string, boolean>();
  for (let i = 0; i < allPhones.length; i += 50) {
    const batch = allPhones.slice(i, i + 50);
    console.log(`Verificando batch ${Math.floor(i / 50) + 1}/${Math.ceil(allPhones.length / 50)} (${batch.length} numeros)...`);
    const batchResults = await checkWhatsApp(batch);
    for (const [phone, hasWA] of batchResults) {
      waResults.set(phone, hasWA);
    }
  }

  const leadsWithWA = new Set<number>();
  for (const [phone, hasWA] of waResults) {
    if (hasWA) {
      const leadIds = leadPhoneMap.get(phone) || [];
      for (const lid of leadIds) leadsWithWA.add(lid);
    }
  }

  let validated = 0;
  let noWA = 0;
  for (const lead of needsWA) {
    const hasWA = leadsWithWA.has(lead.id);
    await db.update(leads).set({ temWhatsapp: hasWA }).where(eq(leads.id, lead.id));
    if (hasWA) validated++;
    else noWA++;
  }

  console.log(`\nResultado: ${validated} com WhatsApp, ${noWA} sem WhatsApp`);

  const [final] = await db.select({
    comWA: sql`count(*) FILTER (WHERE categoria = 'contabilidade' AND tem_whatsapp = true)`,
    semEnvio: sql`count(*) FILTER (WHERE categoria = 'contabilidade' AND tem_whatsapp = true AND whatsapp_sent_count = 0)`,
  }).from(leads);

  console.log(`\nTotal contabilidades com WhatsApp: ${final.comWA} (${final.semEnvio} disponiveis para envio)`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
