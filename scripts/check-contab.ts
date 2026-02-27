import { db } from "../src/config/database.js";
import { leads } from "../src/db/schema.js";
import { sql } from "drizzle-orm";

async function main() {
  const [stats] = await db.select({
    totalContab: sql`count(*) FILTER (WHERE categoria = 'contabilidade')`,
    comTelefone: sql`count(*) FILTER (WHERE categoria = 'contabilidade' AND telefones IS NOT NULL AND telefones != '')`,
    comWhatsapp: sql`count(*) FILTER (WHERE categoria = 'contabilidade' AND tem_whatsapp = true)`,
    semEnvio: sql`count(*) FILTER (WHERE categoria = 'contabilidade' AND tem_whatsapp = true AND whatsapp_sent_count = 0)`,
    jaEnviados: sql`count(*) FILTER (WHERE categoria = 'contabilidade' AND whatsapp_sent_count > 0)`,
  }).from(leads);

  console.log("=== Contabilidades ===");
  console.log(`Total:           ${stats.totalContab}`);
  console.log(`Com telefone:    ${stats.comTelefone}`);
  console.log(`Com WhatsApp:    ${stats.comWhatsapp}`);
  console.log(`Sem envio (WA):  ${stats.semEnvio}`);
  console.log(`Ja enviados:     ${stats.jaEnviados}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
