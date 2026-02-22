import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "../config/database.js";
import {
  automationJobs,
  automationRunLog,
  emailSendLog,
  fornecedores,
  leads,
} from "../db/schema.js";
import { sendEmail } from "./resend.service.js";
import { runEmailSearch } from "./email-search.service.js";
import { classifyLead } from "../utils/email-category.js";
import { getSource } from "./data-sources/index.js";
import { logger } from "../utils/logger.js";
import { mergePhones, isMobilePhone, parsePhoneList } from "../utils/phone.js";

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
