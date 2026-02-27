import { db } from "../src/config/database.js";
import { leads } from "../src/db/schema.js";
import { eq, and, sql, isNull } from "drizzle-orm";
import { lookupCnpj } from "../src/services/cnpj-lookup.service.js";
import { mergePhones, parsePhoneList, isMobilePhone } from "../src/utils/phone.js";
import { checkWhatsAppNumbersBatched } from "../src/services/whatsapp.service.js";

const BATCH_SIZE = 100;

async function main() {
  // 1. Get contabilidade leads without phones
  const noPhone = await db.select().from(leads).where(
    and(
      eq(leads.categoria, "contabilidade"),
      sql`(${leads.telefones} IS NULL OR ${leads.telefones} = '')`,
      sql`length(${leads.cnpj}) = 14`
    )
  );

  console.log(`=== Enriquecimento de Contabilidades ===`);
  console.log(`Sem telefone: ${noPhone.length}`);

  const batch = noPhone.slice(0, BATCH_SIZE);
  console.log(`Processando: ${batch.length}\n`);

  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i++) {
    const lead = batch[i];
    try {
      const data = await lookupCnpj(lead.cnpj);
      if (data.telefones) {
        const phones = mergePhones(data.telefones);
        const hasMob = phones ? parsePhoneList(phones).some(isMobilePhone) : false;
        const updates: Record<string, any> = { telefones: phones, temCelular: hasMob };
        if (data.email && !lead.email) updates.email = data.email.toLowerCase();
        if (data.razaoSocial && !lead.razaoSocial) updates.razaoSocial = data.razaoSocial;
        if (data.nomeFantasia && !lead.nomeFantasia) updates.nomeFantasia = data.nomeFantasia;
        await db.update(leads).set(updates).where(eq(leads.id, lead.id));
        enriched++;
        console.log(`${i + 1}/${batch.length} ${lead.cnpj} -> ${phones}`);
      } else {
        console.log(`${i + 1}/${batch.length} ${lead.cnpj} -> sem telefone`);
      }
    } catch (err: any) {
      failed++;
      console.log(`${i + 1}/${batch.length} ${lead.cnpj} -> ERRO: ${err.message}`);
    }
  }

  console.log(`\nEnriquecimento: ${enriched} com telefone, ${failed} erros`);

  // 2. Now validate WhatsApp for contabilidades with phones but no WA validation
  console.log(`\n=== Validacao WhatsApp ===`);

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

  // Collect phones
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
  console.log(`Telefones unicos a checar: ${allPhones.length}`);

  const waResults = await checkWhatsAppNumbersBatched(allPhones, 50);
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

  // Final stats
  const [final] = await db.select({
    comWA: sql`count(*) FILTER (WHERE categoria = 'contabilidade' AND tem_whatsapp = true)`,
    semEnvio: sql`count(*) FILTER (WHERE categoria = 'contabilidade' AND tem_whatsapp = true AND whatsapp_sent_count = 0)`,
  }).from(leads);

  console.log(`\n=== Total contabilidades com WhatsApp: ${final.comWA} (${final.semEnvio} sem envio) ===`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
