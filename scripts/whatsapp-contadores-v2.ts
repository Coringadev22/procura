import { db } from "../src/config/database.js";
import { leads, whatsappSendLog } from "../src/db/schema.js";
import { eq, and, sql } from "drizzle-orm";

const EVOLUTION_API_URL = "https://evolution-api-production-1d69.up.railway.app";
const EVOLUTION_API_KEY = "b121eb42081ae211e20207d6c9b9631c";
const INSTANCE = "Alvaro";
const DELAY_MS = 5 * 60 * 1000; // 5 minutos

const MESSAGE = "Aqui é o Alvaro, sou advogado, e queria saber se vocês já tem parceria com escritório de advocacia. Somos da área de licitações.";

async function sendWhatsApp(phone: string, text: string) {
  const number = phone.replace("+", "");
  const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${INSTANCE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
    body: JSON.stringify({ number, text }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data?.key?.id || data?.messageId || null;
}

async function main() {
  // Get the 5 remaining contabilidade leads with WhatsApp but not yet sent
  const remaining = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.categoria, "contabilidade"),
        eq(leads.temWhatsapp, true),
        eq(leads.whatsappSentCount, 0)
      )
    );

  console.log(`=== WhatsApp Contadores V2 ===`);
  console.log(`Mensagem: "${MESSAGE}"`);
  console.log(`Leads restantes: ${remaining.length}\n`);

  let sent = 0;
  for (let i = 0; i < remaining.length; i++) {
    const lead = remaining[i];
    const phones = (lead.telefones || "").split(",").map(p => p.trim()).filter(Boolean);
    const phone = phones[0];
    if (!phone) {
      console.log(`[${i+1}/${remaining.length}] ${lead.razaoSocial} — sem telefone, pulando`);
      continue;
    }

    console.log(`[${i+1}/${remaining.length}] Enviando para ${lead.razaoSocial?.substring(0,45)} | ${phone}`);
    try {
      const messageId = await sendWhatsApp(phone, MESSAGE);
      console.log(`  ✓ Enviado! messageId: ${messageId}`);

      // Log to whatsapp_send_log
      await db.insert(whatsappSendLog).values({
        leadId: lead.id,
        recipientPhone: phone,
        recipientCnpj: lead.cnpj,
        recipientName: lead.razaoSocial || lead.nomeFantasia || null,
        templateName: "Contabilidade V1 Humanizada",
        messageText: MESSAGE,
        messageSequence: 1,
        status: "sent",
        externalMessageId: messageId,
      });

      // Update lead
      await db.update(leads)
        .set({
          whatsappSentAt: new Date().toISOString(),
          whatsappSentCount: sql`${leads.whatsappSentCount} + 1`,
        })
        .where(eq(leads.id, lead.id));

      sent++;
    } catch (err: any) {
      console.log(`  ✗ Erro: ${err.message}`);
    }

    if (i < remaining.length - 1) {
      const next = new Date(Date.now() + DELAY_MS).toLocaleTimeString("pt-BR");
      console.log(`  Aguardando 5 min... próximo envio às ${next}\n`);
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n=== Concluído: ${sent}/${remaining.length} enviados ===`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
