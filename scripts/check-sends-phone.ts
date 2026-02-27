import { db } from "../src/config/database.js";
import { whatsappSendLog } from "../src/db/schema.js";
import { sql } from "drizzle-orm";

async function main() {
  // All sends to this number
  const sends = await db.select().from(whatsappSendLog).where(
    sql`${whatsappSendLog.recipientPhone} LIKE '%3233325554%'`
  );
  console.log(`Envios para 3233325554: ${sends.length}`);
  for (const s of sends) {
    console.log(`  id=${s.id} phone=${s.recipientPhone} name=${s.recipientName} template=${s.templateName} seq=${s.messageSequence} at=${s.sentAt} status=${s.status}`);
  }

  // Also check all sends total
  const all = await db.select().from(whatsappSendLog);
  console.log(`\nTotal envios no log: ${all.length}`);

  // Check the lead
  const { leads } = await import("../src/db/schema.js");
  const { eq } = await import("drizzle-orm");
  const lead = await db.select().from(leads).where(
    sql`${leads.telefones} LIKE '%3233325554%'`
  );
  for (const l of lead) {
    console.log(`\nLead: id=${l.id} cnpj=${l.cnpj} razao=${l.razaoSocial} cat=${l.categoria} sentCount=${l.whatsappSentCount} sentAt=${l.whatsappSentAt}`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
