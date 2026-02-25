import { eq, and, isNotNull, sql } from "drizzle-orm";
import { db } from "../config/database.js";
import {
  automationJobs,
  automationRunLog,
  emailSendLog,
  fornecedores,
  leads,
  whatsappSendLog,
} from "../db/schema.js";
import { sendEmail } from "./resend.service.js";
import { runEmailSearch } from "./email-search.service.js";
import { classifyLead } from "../utils/email-category.js";
import { getSource } from "./data-sources/index.js";
import { logger } from "../utils/logger.js";
import { mergePhones, isMobilePhone, parsePhoneList } from "../utils/phone.js";
import { sendCampaignWhatsApp, isConnected, checkWhatsAppNumbersBatched } from "./whatsapp.service.js";
import { lookupCnpj } from "./cnpj-lookup.service.js";

const activeTimers = new Map<number, NodeJS.Timeout>();

export async function startAutomationScheduler(): Promise<void> {
  const jobs = await db
    .select()
    .from(automationJobs)
    .where(eq(automationJobs.isActive, true));

  // Mark orphaned running runs as failed (server restart recovery)
  const runningRuns = await db
    .select()
    .from(automationRunLog)
    .where(eq(automationRunLog.status, "running"));

  for (const run of runningRuns) {
    await db.update(automationRunLog)
      .set({
        status: "failed",
        completedAt: new Date().toISOString(),
        errorMessage: "Servidor reiniciado durante execucao",
      })
      .where(eq(automationRunLog.id, run.id));
  }

  for (const job of jobs) {
    await scheduleJob(job.id);
  }

  logger.info(
    `Automation scheduler iniciado: ${jobs.length} job(s) ativo(s)`
  );
}

function getIntervalMs(job: { intervalHours: number }): number {
  return job.intervalHours * 3_600_000;
}

export async function scheduleJob(jobId: number): Promise<void> {
  cancelJob(jobId);

  const [job] = await db
    .select()
    .from(automationJobs)
    .where(eq(automationJobs.id, jobId));

  if (!job || !job.isActive) return;

  let delayMs: number;

  if (job.nextRunAt) {
    delayMs = new Date(job.nextRunAt).getTime() - Date.now();
    if (delayMs < 0) delayMs = 1000; // missed run, execute soon
  } else {
    const nextRun = new Date(Date.now() + getIntervalMs(job));
    await db.update(automationJobs)
      .set({ nextRunAt: nextRun.toISOString() })
      .where(eq(automationJobs.id, jobId));
    delayMs = getIntervalMs(job);
  }

  const timer = setTimeout(async () => {
    activeTimers.delete(jobId);
    await executeJob(jobId);
  }, delayMs);

  activeTimers.set(jobId, timer);

  const nextDate = new Date(Date.now() + delayMs);
  logger.info(
    `Job "${job.name}" (id=${jobId}) agendado para ${nextDate.toISOString()}`
  );
}

export function cancelJob(jobId: number): void {
  const timer = activeTimers.get(jobId);
  if (timer) {
    clearTimeout(timer);
    activeTimers.delete(jobId);
  }
}

export function cancelAllJobs(): void {
  for (const [, timer] of activeTimers) {
    clearTimeout(timer);
  }
  activeTimers.clear();
}

export async function getSchedulerStatus() {
  const allJobs = await db.select().from(automationJobs);
  const activeCount = allJobs.filter((j) => j.isActive).length;

  let nextRun: string | null = null;
  for (const job of allJobs) {
    if (job.isActive && job.nextRunAt) {
      if (!nextRun || job.nextRunAt < nextRun) {
        nextRun = job.nextRunAt;
      }
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const allSent = await db
    .select()
    .from(emailSendLog)
    .where(eq(emailSendLog.status, "sent"));

  const todaySent = allSent.filter((l) => l.sentAt?.startsWith(today)).length;

  return {
    activeJobs: activeCount,
    totalJobs: allJobs.length,
    nextRun,
    todayEmailsSent: todaySent,
    schedulerRunning: true,
  };
}

export async function executeJob(jobId: number): Promise<void> {
  const [job] = await db
    .select()
    .from(automationJobs)
    .where(eq(automationJobs.id, jobId));

  if (!job || !job.isActive) return;

  logger.info(`Executando automacao "${job.name}" (id=${jobId}, tipo=${job.jobType})...`);

  const [runLog] = await db
    .insert(automationRunLog)
    .values({ jobId, status: "running" })
    .returning({ id: automationRunLog.id });
  const runLogId = runLog.id;

  let emailsFound = 0;
  let emailsSent = 0;
  let emailsFailed = 0;
  let emailsSkipped = 0;

  try {
    // ========== ENRICH PHONES ==========
    if (job.jobType === "enrich_phones") {
      const limit = job.maxEmailsPerRun;

      const needsEnrich = await db.select().from(leads).where(
        sql`(${leads.telefones} IS NULL OR ${leads.telefones} = '') AND length(${leads.cnpj}) = 14`
      );

      // Sort: emailed leads first (most valuable to enrich)
      needsEnrich.sort((a, b) => (b.emailSentCount ?? 0) - (a.emailSentCount ?? 0));
      const batch = needsEnrich.slice(0, limit);

      emailsFound = batch.length;
      let enriched = 0;
      let enrichFailed = 0;
      let fromCache = 0;

      for (const lead of batch) {
        try {
          // Pass 1: Check if fornecedores cache already has phones
          const [cached] = await db.select().from(fornecedores).where(eq(fornecedores.cnpj, lead.cnpj));

          if (cached?.telefones) {
            // Cache has phones — copy to lead directly (fast)
            const nPhones = mergePhones(cached.telefones);
            const hasMob = nPhones ? parsePhoneList(nPhones).some(isMobilePhone) : false;
            const updates: Record<string, any> = { telefones: nPhones, temCelular: hasMob };
            if (cached.email && !lead.email) updates.email = cached.email.toLowerCase();
            if (cached.razaoSocial && !lead.razaoSocial) updates.razaoSocial = cached.razaoSocial;
            if (cached.nomeFantasia && !lead.nomeFantasia) updates.nomeFantasia = cached.nomeFantasia;
            if (cached.municipio && !lead.municipio) updates.municipio = cached.municipio;
            if (cached.uf && !lead.uf) updates.uf = cached.uf;
            await db.update(leads).set(updates).where(eq(leads.id, lead.id));
            enriched++;
            fromCache++;
            continue;
          }

          // Pass 2: No phones in cache — invalidate cache and force fresh API lookup
          if (cached) {
            await db.delete(fornecedores).where(eq(fornecedores.cnpj, lead.cnpj));
          }
          const data = await lookupCnpj(lead.cnpj);
          const updates: Record<string, any> = {};

          if (data.telefones) {
            const nPhones = mergePhones(data.telefones);
            const hasMob = nPhones ? parsePhoneList(nPhones).some(isMobilePhone) : false;
            updates.telefones = nPhones;
            updates.temCelular = hasMob;
          }
          if (data.email && !lead.email) updates.email = data.email.toLowerCase();
          if (data.razaoSocial && !lead.razaoSocial) updates.razaoSocial = data.razaoSocial;
          if (data.nomeFantasia && !lead.nomeFantasia) updates.nomeFantasia = data.nomeFantasia;
          if (data.municipio && !lead.municipio) updates.municipio = data.municipio;
          if (data.uf && !lead.uf) updates.uf = data.uf;

          if (Object.keys(updates).length > 0) {
            await db.update(leads).set(updates).where(eq(leads.id, lead.id));
            if (updates.telefones) enriched++;
          }
        } catch (err: any) {
          logger.error(`Enrich phones error for ${lead.cnpj}: ${err.message}`);
          enrichFailed++;
        }
      }

      emailsSent = enriched;
      emailsFailed = enrichFailed;

      const now = new Date().toISOString();
      await db.update(automationRunLog)
        .set({
          completedAt: now,
          status: enrichFailed > 0 && enriched === 0 ? "failed" : "completed",
          emailsFound: batch.length,
          emailsSent: enriched,
          emailsFailed: enrichFailed,
          emailsSkipped: 0,
        })
        .where(eq(automationRunLog.id, runLogId));

      const nextRun = new Date(Date.now() + getIntervalMs(job));
      await db.update(automationJobs)
        .set({
          lastRunAt: now,
          nextRunAt: nextRun.toISOString(),
          lastRunStatus: enrichFailed > 0 && enriched === 0 ? "failed" : "success",
          lastRunStats: JSON.stringify({
            totalPending: needsEnrich.length,
            processed: batch.length,
            enriched,
            fromCache,
            failed: enrichFailed,
          }),
          updatedAt: now,
        })
        .where(eq(automationJobs.id, jobId));

      logger.info(
        `Enrich Phones "${job.name}" concluido: ${enriched} enriquecidos (${fromCache} do cache), ${enrichFailed} falharam de ${batch.length} processados (${needsEnrich.length} pendentes total)`
      );

      await scheduleJob(jobId);
      return;
    }

    // ========== WHATSAPP VALIDATE ==========
    if (job.jobType === "whatsapp_validate") {
      const connected = await isConnected();
      if (!connected) {
        throw new Error("WhatsApp nao conectado");
      }

      const limit = job.maxEmailsPerRun;

      const needsValidation = await db.select().from(leads).where(
        and(
          eq(leads.temWhatsapp, false),
          isNotNull(leads.telefones),
          sql`${leads.telefones} != ''`
        )
      );

      const batch = needsValidation.slice(0, limit);
      emailsFound = batch.length;

      // Collect all unique phones across all leads
      const leadPhoneMap = new Map<string, number[]>();
      for (const lead of batch) {
        const phones = parsePhoneList(lead.telefones!);
        for (const phone of phones) {
          const existing = leadPhoneMap.get(phone) || [];
          existing.push(lead.id);
          leadPhoneMap.set(phone, existing);
        }
      }

      const allPhones = [...leadPhoneMap.keys()];

      // Check all phones against WhatsApp in batches
      const whatsappPhones = await checkWhatsAppNumbersBatched(allPhones, 50);

      // Find which leads have at least one WhatsApp phone
      const leadsWithWhatsApp = new Set<number>();
      for (const [phone, exists] of whatsappPhones) {
        if (exists) {
          const leadIds = leadPhoneMap.get(phone) || [];
          for (const id of leadIds) {
            leadsWithWhatsApp.add(id);
          }
        }
      }

      // Update leads
      let validated = 0;
      let noWhatsApp = 0;
      let validateFailed = 0;

      for (const lead of batch) {
        try {
          const hasWhatsApp = leadsWithWhatsApp.has(lead.id);
          await db.update(leads)
            .set({ temWhatsapp: hasWhatsApp })
            .where(eq(leads.id, lead.id));
          if (hasWhatsApp) validated++;
          else noWhatsApp++;
        } catch {
          validateFailed++;
        }
      }

      emailsSent = validated;
      emailsFailed = validateFailed;

      const now = new Date().toISOString();
      await db.update(automationRunLog)
        .set({
          completedAt: now,
          status: validateFailed > 0 && validated === 0 ? "failed" : "completed",
          emailsFound: batch.length,
          emailsSent: validated,
          emailsFailed: validateFailed,
          emailsSkipped: noWhatsApp,
        })
        .where(eq(automationRunLog.id, runLogId));

      const nextRun = new Date(Date.now() + getIntervalMs(job));
      await db.update(automationJobs)
        .set({
          lastRunAt: now,
          nextRunAt: nextRun.toISOString(),
          lastRunStatus: validateFailed > 0 && validated === 0 ? "failed" : "success",
          lastRunStats: JSON.stringify({
            totalPending: needsValidation.length,
            checked: batch.length,
            validated,
            noWhatsApp,
            failed: validateFailed,
            phonesChecked: allPhones.length,
          }),
          updatedAt: now,
        })
        .where(eq(automationJobs.id, jobId));

      logger.info(
        `WhatsApp Validate "${job.name}" concluido: ${validated} com WhatsApp, ${noWhatsApp} sem, ${validateFailed} falharam de ${batch.length} verificados`
      );

      await scheduleJob(jobId);
      return;
    }

    // 1. Gather recipients from search and/or fornecedores
    interface Recipient {
      email: string;
      cnpj: string;
      empresa: string;
      nomeFantasia: string | null;
      cnaePrincipal: string | null;
      emailCategory: string;
      telefones: string | null;
      municipio: string | null;
      uf: string | null;
      valor: string;
      valorNum: number | null;
      tipoPessoa?: "PJ" | "PF";
      cpf?: string;
      nomeCompleto?: string;
    }

    const recipientMap = new Map<string, Recipient>();
    let activeFonte = job.sourceType || "pncp";

    // Try modular data source first
    const dataSource = getSource(job.sourceType);

    if (dataSource) {
      // Use modular data source adapter
      try {
        const sourceResults = await dataSource.fetch({
          keyword: job.searchKeyword || undefined,
          uf: job.searchUf ?? undefined,
          quantity: job.searchQuantity,
          cnae: job.searchCnae ?? undefined,
        });

        activeFonte = dataSource.name;
        for (const sr of sourceResults) {
          // For populate_leads: save ALL results (even without email)
          // For email_send: only save results with email
          const key = sr.email
            ? sr.email.toLowerCase()
            : `cnpj:${sr.cnpj}`;
          if (job.jobType === "populate_leads") {
            if (!recipientMap.has(key)) {
              recipientMap.set(key, {
                email: sr.email || "",
                cnpj: sr.cnpj,
                empresa: sr.razaoSocial || "",
                nomeFantasia: null,
                cnaePrincipal: sr.cnaePrincipal || null,
                emailCategory: "empresa",
                telefones: sr.telefones || null,
                municipio: sr.municipio || null,
                uf: sr.uf || null,
                valor: sr.valorHomologado
                  ? `R$ ${sr.valorHomologado.toLocaleString("pt-BR")}`
                  : "",
                valorNum: sr.valorHomologado ?? null,
                tipoPessoa: sr.tipoPessoa,
                cpf: sr.cpf,
                nomeCompleto: sr.nomeCompleto,
              });
            }
          } else if (sr.email && !recipientMap.has(key)) {
            recipientMap.set(key, {
              email: sr.email,
              cnpj: sr.cnpj,
              empresa: sr.razaoSocial || "",
              nomeFantasia: null,
              cnaePrincipal: sr.cnaePrincipal || null,
              emailCategory: "empresa",
              telefones: sr.telefones || null,
              municipio: sr.municipio || null,
              uf: sr.uf || null,
              valor: sr.valorHomologado
                ? `R$ ${sr.valorHomologado.toLocaleString("pt-BR")}`
                : "",
              valorNum: sr.valorHomologado ?? null,
              tipoPessoa: sr.tipoPessoa,
              cpf: sr.cpf,
              nomeCompleto: sr.nomeCompleto,
            });
          }
        }
        logger.info(`Data source ${job.sourceType}: ${sourceResults.length} resultados, ${recipientMap.size} no recipientMap`);
      } catch (err: any) {
        logger.error(`Data source ${job.sourceType} error: ${err.message}`);
        // Surface error in job stats so it's visible in the dashboard
        const now = new Date().toISOString();
        await db.update(automationJobs)
          .set({
            lastRunStats: JSON.stringify({ error: `${job.sourceType}: ${err.message}` }),
            updatedAt: now,
          })
          .where(eq(automationJobs.id, jobId));
      }
    } else if (job.sourceType === "search" || job.sourceType === "both") {
      // Legacy: use old search flow
      try {
        const searchResult = await runEmailSearch({
          q: job.searchKeyword,
          uf: job.searchUf ?? undefined,
          minResultados: job.searchQuantity,
        });

        activeFonte = "pncp";
        for (const f of searchResult.data) {
          if (f.email && !recipientMap.has(f.email.toLowerCase())) {
            recipientMap.set(f.email.toLowerCase(), {
              email: f.email,
              cnpj: f.cnpj,
              empresa: f.razaoSocial || f.nomeFantasia || "",
              nomeFantasia: f.nomeFantasia,
              cnaePrincipal: f.cnaePrincipal,
              emailCategory: f.emailCategory,
              telefones: f.telefones,
              municipio: f.municipio,
              uf: f.uf,
              valor: f.valorHomologado
                ? `R$ ${f.valorHomologado.toLocaleString("pt-BR")}`
                : "",
              valorNum: f.valorHomologado ?? null,
            });
          }
        }
      } catch (err: any) {
        logger.error(`Automation search error: ${err.message}`);
      }
    }

    if (job.sourceType === "fornecedores" || job.sourceType === "both") {
      const dbFornecedores = await db
        .select()
        .from(fornecedores)
        .where(isNotNull(fornecedores.email));

      activeFonte = "fornecedores";
      for (const f of dbFornecedores) {
        if (f.email && !recipientMap.has(f.email.toLowerCase())) {
          recipientMap.set(f.email.toLowerCase(), {
            email: f.email,
            cnpj: f.cnpj,
            empresa: f.razaoSocial || f.nomeFantasia || "",
            nomeFantasia: f.nomeFantasia,
            cnaePrincipal: f.cnaePrincipal,
            emailCategory: f.emailCategory || "empresa",
            telefones: f.telefones,
            municipio: f.municipio,
            uf: f.uf,
            valor: "",
            valorNum: null,
          });
        }
      }
    }

    let recipients = [...recipientMap.values()];

    // 2. Filter by targetCategory
    if (job.targetCategory && job.targetCategory !== "all") {
      recipients = recipients.filter(
        (r) => r.emailCategory === job.targetCategory
      );
    }

    // 3. Filter by CNAE
    if (job.searchCnae) {
      const cnaeFilter = job.searchCnae.toLowerCase();
      recipients = recipients.filter(
        (r) =>
          r.cnaePrincipal &&
          r.cnaePrincipal.toLowerCase().includes(cnaeFilter)
      );
    }

    emailsFound = recipients.length;

    // ========== POPULATE LEADS ==========
    if (job.jobType === "populate_leads") {
      let leadsAdded = 0;
      let leadsSkipped = 0;

      recipients = recipients.slice(0, job.maxEmailsPerRun);

      for (const r of recipients) {
        const cnpj = r.cnpj.replace(/\D/g, "");
        if (!cnpj) { leadsSkipped++; continue; }

        // Check if CNPJ already exists in leads
        const [existing] = await db.select({ id: leads.id }).from(leads).where(eq(leads.cnpj, cnpj));
        if (existing) { leadsSkipped++; continue; }

        // Check if email already exists in leads
        if (r.email) {
          const [byEmail] = await db.select({ id: leads.id }).from(leads).where(eq(leads.email, r.email.toLowerCase()));
          if (byEmail) { leadsSkipped++; continue; }
        }

        // Classify using full analysis (email + CNAE + razao social)
        const categoria = classifyLead(r.email, r.cnaePrincipal, r.empresa);

        const normalizedPhones = mergePhones(r.telefones || null);
        const hasMobile = normalizedPhones
          ? parsePhoneList(normalizedPhones).some(isMobilePhone)
          : false;

        await db.insert(leads).values({
          cnpj,
          tipoPessoa: r.tipoPessoa || "PJ",
          cpf: r.cpf || null,
          nomeCompleto: r.nomeCompleto || null,
          razaoSocial: r.empresa || null,
          nomeFantasia: r.nomeFantasia || null,
          email: r.email?.toLowerCase() || null,
          telefones: normalizedPhones,
          municipio: r.municipio || null,
          uf: r.uf || job.searchUf || null,
          cnaePrincipal: r.cnaePrincipal || null,
          origem: "auto_job_" + jobId,
          fonte: activeFonte,
          valorHomologado: r.valorNum,
          categoria,
          temCelular: hasMobile,
        });
        leadsAdded++;
      }

      emailsSent = leadsAdded; // reuse field for "leads added"
      emailsSkipped = leadsSkipped;

      const now = new Date().toISOString();
      await db.update(automationRunLog)
        .set({
          completedAt: now,
          status: "completed",
          emailsFound,
          emailsSent: leadsAdded,
          emailsFailed: 0,
          emailsSkipped: leadsSkipped,
        })
        .where(eq(automationRunLog.id, runLogId));

      const nextRun = new Date(Date.now() + getIntervalMs(job));
      await db.update(automationJobs)
        .set({
          lastRunAt: now,
          nextRunAt: nextRun.toISOString(),
          lastRunStatus: "success",
          lastRunStats: JSON.stringify({ emailsFound, leadsAdded, leadsSkipped }),
          updatedAt: now,
        })
        .where(eq(automationJobs.id, jobId));

      logger.info(
        `Automacao "${job.name}" concluida: ${leadsAdded} leads adicionados, ${leadsSkipped} ignorados de ${emailsFound} encontrados`
      );

    // ========== WHATSAPP SEND ==========
    } else if (job.jobType === "whatsapp_send") {
      const connected = await isConnected();
      if (!connected) {
        throw new Error("WhatsApp não conectado");
      }

      // Import template selector
      const { getTemplateForLead } = await import("./whatsapp-campaign.service.js");

      // Query leads matching criteria: has WhatsApp, never WPP'd
      const conditions = [
        eq(leads.temWhatsapp, true),
        isNotNull(leads.telefones),
        eq(leads.whatsappSentCount, 0),
      ];
      if (job.targetCategory && job.targetCategory !== "all") {
        conditions.push(eq(leads.categoria, job.targetCategory));
      }
      // Also exclude opted-out leads
      conditions.push(sql`${leads.whatsappSentCount} >= 0`);

      const wppCandidates = await db
        .select()
        .from(leads)
        .where(and(...conditions))
        .limit(job.maxEmailsPerRun);

      emailsFound = wppCandidates.length;
      let wppSent = 0;
      let wppFailed = 0;

      const delayMs = (job.searchQuantity || 300) * 1000; // searchQuantity = delay in seconds (default 5 min)

      logger.info(
        `WhatsApp Job "${job.name}": ${wppCandidates.length} leads, delay=${delayMs / 1000}s`
      );

      for (const lead of wppCandidates) {
        try {
          const tpl = getTemplateForLead(lead, 1);
          const success = await sendCampaignWhatsApp(lead, tpl.name, tpl.body, 1);
          if (success) {
            wppSent++;
          } else {
            wppFailed++;
          }
        } catch (err: any) {
          logger.error(`WhatsApp Job send error for ${lead.cnpj}: ${err.message}`);
          wppFailed++;
        }

        // Delay between messages
        if (wppSent + wppFailed < wppCandidates.length) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }

      emailsSent = wppSent;
      emailsFailed = wppFailed;

      const now = new Date().toISOString();
      await db.update(automationRunLog)
        .set({
          completedAt: now,
          status: wppFailed > 0 && wppSent === 0 ? "failed" : "completed",
          emailsFound,
          emailsSent: wppSent,
          emailsFailed: wppFailed,
          emailsSkipped: 0,
        })
        .where(eq(automationRunLog.id, runLogId));

      const nextRun = new Date(Date.now() + getIntervalMs(job));
      await db.update(automationJobs)
        .set({
          lastRunAt: now,
          nextRunAt: nextRun.toISOString(),
          lastRunStatus: wppFailed > 0 && wppSent === 0 ? "failed" : "success",
          lastRunStats: JSON.stringify({ found: emailsFound, sent: wppSent, failed: wppFailed }),
          updatedAt: now,
        })
        .where(eq(automationJobs.id, jobId));

      logger.info(
        `WhatsApp Job "${job.name}" concluido: ${wppSent} enviados, ${wppFailed} falharam de ${emailsFound} elegíveis`
      );

    // ========== EMAIL SEND (original flow) ==========
    } else {
      // 4. Deduplicate against already-sent emails
      if (job.templateId) {
        const sentEmails = await db
          .select({ email: emailSendLog.recipientEmail })
          .from(emailSendLog)
          .where(
            and(
              eq(emailSendLog.templateId, job.templateId),
              eq(emailSendLog.status, "sent")
            )
          );

        const sentSet = new Set(
          sentEmails.map((r) => r.email.toLowerCase())
        );

        const before = recipients.length;
        recipients = recipients.filter(
          (r) => !sentSet.has(r.email.toLowerCase())
        );
        emailsSkipped = before - recipients.length;
      }

      recipients = recipients.slice(0, job.maxEmailsPerRun);

      // 5. Send emails
      if (recipients.length > 0 && job.templateId) {
        for (let i = 0; i < recipients.length; i++) {
          const r = recipients[i];
          const vars: Record<string, string> = {
            empresa: r.empresa,
            cnpj: r.cnpj,
            email: r.email,
            contato: r.empresa,
            valor: r.valor,
            cidade: r.municipio || "",
            uf: r.uf || "",
          };

          const result = await sendEmail(
            job.templateId,
            r.email,
            r.cnpj,
            vars
          );

          if (result.success) emailsSent++;
          else emailsFailed++;

          if (i < recipients.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }

      // 6. Update run log
      const now = new Date().toISOString();
      await db.update(automationRunLog)
        .set({
          completedAt: now,
          status: emailsFailed > 0 && emailsSent === 0 ? "failed" : "completed",
          emailsFound,
          emailsSent,
          emailsFailed,
          emailsSkipped,
        })
        .where(eq(automationRunLog.id, runLogId));

      // 7. Update job
      const nextRun = new Date(Date.now() + getIntervalMs(job));
      await db.update(automationJobs)
        .set({
          lastRunAt: now,
          nextRunAt: nextRun.toISOString(),
          lastRunStatus:
            emailsFailed > 0 && emailsSent === 0 ? "failed" : "success",
          lastRunStats: JSON.stringify({ emailsFound, emailsSent, emailsFailed, emailsSkipped }),
          updatedAt: now,
        })
        .where(eq(automationJobs.id, jobId));

      logger.info(
        `Automacao "${job.name}" concluida: ${emailsSent} enviados, ${emailsFailed} falharam, ${emailsSkipped} ignorados`
      );
    }
  } catch (err: any) {
    logger.error(`Automation job error (id=${jobId}): ${err.message}`);

    await db.update(automationRunLog)
      .set({
        completedAt: new Date().toISOString(),
        status: "failed",
        emailsFound,
        emailsSent,
        emailsFailed,
        emailsSkipped,
        errorMessage: err.message,
      })
      .where(eq(automationRunLog.id, runLogId));

    const now = new Date().toISOString();
    const nextRun = new Date(Date.now() + getIntervalMs(job));
    await db.update(automationJobs)
      .set({
        lastRunAt: now,
        nextRunAt: nextRun.toISOString(),
        lastRunStatus: "failed",
        lastRunStats: JSON.stringify({ emailsFound, emailsSent, emailsFailed, emailsSkipped }),
        updatedAt: now,
      })
      .where(eq(automationJobs.id, jobId));
  }

  // Reschedule
  await scheduleJob(jobId);
}

// ============ SEED DEFAULT ENRICHMENT JOBS ============

export async function seedDefaultEnrichmentJobs(): Promise<void> {
  const existingJobs = await db.select().from(automationJobs);
  const hasEnrichPhones = existingJobs.some(j => j.jobType === "enrich_phones");
  const hasWaValidate = existingJobs.some(j => j.jobType === "whatsapp_validate");

  if (!hasEnrichPhones) {
    const [job] = await db.insert(automationJobs).values({
      name: "Enriquecer Telefones (auto)",
      jobType: "enrich_phones",
      intervalHours: 6,
      maxEmailsPerRun: 100,
      searchKeyword: "",
      sourceType: "leads",
      isActive: true,
    }).returning({ id: automationJobs.id });

    await scheduleJob(job.id);
    logger.info(`Seed: job enrich_phones criado (id=${job.id})`);
  }

  if (!hasWaValidate) {
    const [job] = await db.insert(automationJobs).values({
      name: "Validar WhatsApp (auto)",
      jobType: "whatsapp_validate",
      intervalHours: 12,
      maxEmailsPerRun: 200,
      searchKeyword: "",
      sourceType: "leads",
      isActive: true,
    }).returning({ id: automationJobs.id });

    await scheduleJob(job.id);
    logger.info(`Seed: job whatsapp_validate criado (id=${job.id})`);
  }
}
