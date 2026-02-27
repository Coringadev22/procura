import { db } from "../src/config/database.js";
import { leads, whatsappSendLog } from "../src/db/schema.js";
import { eq, and, sql } from "drizzle-orm";

async function main() {
  const contabs = await db.select({
    id: leads.id,
    cnpj: leads.cnpj,
    razaoSocial: leads.razaoSocial,
    telefones: leads.telefones,
    whatsappSentCount: leads.whatsappSentCount,
  }).from(leads).where(
    and(
      eq(leads.categoria, "contabilidade"),
      eq(leads.temWhatsapp, true),
    )
  );

  const phoneMap = new Map<string, any[]>();
  for (const c of contabs) {
    if (!c.telefones) continue;
    const phones = c.telefones.split(",").map(p => p.trim());
    for (const phone of phones) {
      if (!phoneMap.has(phone)) phoneMap.set(phone, []);
      phoneMap.get(phone)!.push({ id: c.id, cnpj: c.cnpj, razaoSocial: c.razaoSocial, sentCount: c.whatsappSentCount });
    }
  }

  console.log("Telefones duplicados em contabilidades:");
  let found = false;
  for (const [phone, dups] of phoneMap) {
    if (dups.length > 1) {
      found = true;
      console.log(`  ${phone}:`);
      for (const d of dups) console.log(`    id=${d.id} ${d.cnpj} ${d.razaoSocial || ""} sent=${d.sentCount}`);
    }
  }
  if (!found) console.log("  Nenhum duplicado encontrado");

  // Check what was sent today
  const today = new Date().toISOString().split("T")[0];
  const sentToday = await db.select().from(whatsappSendLog).where(
    sql`${whatsappSendLog.sentAt} LIKE ${today + "%"}`
  );
  console.log(`\nEnvios hoje (${sentToday.length}):`);
  for (const s of sentToday) {
    console.log(`  ${s.recipientPhone} -> ${s.recipientName || s.recipientCnpj} at ${s.sentAt} (seq=${s.messageSequence})`);
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
