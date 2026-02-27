import { db } from "../src/config/database.js";
import { leads, whatsappSendLog } from "../src/db/schema.js";
import { sql } from "drizzle-orm";

async function main() {
  // Stats by fonte for leads with WhatsApp and no send
  const stats = await db.select({
    fonte: leads.fonte,
    categoria: leads.categoria,
    total: sql`count(*)`,
    comTelefone: sql`count(*) FILTER (WHERE telefones IS NOT NULL AND telefones != '')`,
    comWhatsapp: sql`count(*) FILTER (WHERE tem_whatsapp = true)`,
    semEnvio: sql`count(*) FILTER (WHERE tem_whatsapp = true AND whatsapp_sent_count = 0)`,
    jaEnviados: sql`count(*) FILTER (WHERE whatsapp_sent_count > 0)`,
  }).from(leads).groupBy(leads.fonte, leads.categoria).orderBy(sql`count(*) DESC`);

  console.log("=== Leads por fonte/categoria ===\n");
  console.log("Fonte                     | Categoria       | Total | c/Tel | c/WA | Disp | Env");
  console.log("-".repeat(95));
  for (const s of stats) {
    const fonte = (s.fonte || "null").padEnd(25);
    const cat = (s.categoria || "null").padEnd(15);
    console.log(`${fonte} | ${cat} | ${String(s.total).padStart(5)} | ${String(s.comTelefone).padStart(5)} | ${String(s.comWhatsapp).padStart(4)} | ${String(s.semEnvio).padStart(4)} | ${String(s.jaEnviados).padStart(3)}`);
  }

  // Filter only relevant fontes
  console.log("\n=== Resumo fontes solicitadas ===\n");
  const relevant = stats.filter(s =>
    s.fonte === "pncp" || s.fonte === "pncp_contratos" ||
    s.fonte === "diario_oficial" || s.categoria === "contabilidade"
  );

  let totalDisp = 0;
  for (const s of relevant) {
    console.log(`${s.fonte} (${s.categoria}): ${s.semEnvio} disponiveis para WhatsApp`);
    totalDisp += Number(s.semEnvio);
  }
  console.log(`\nTotal disponivel: ${totalDisp}`);

  // Total phones already sent
  const allSent = await db.select({ count: sql`count(DISTINCT recipient_phone)` }).from(whatsappSendLog);
  console.log(`Telefones unicos ja enviados: ${allSent[0].count}`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
