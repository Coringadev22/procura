import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "../config/database.js";
import {
  automationJobs,
  automationRunLog,
  emailSendLog,
  fornecedores,
} from "../db/schema.js";
import { sendEmail } from "./gmail.service.js";
import { runEmailSearch } from "./email-search.service.js";
import { logger } from "../utils/logger.js";

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
    // First run: schedule for intervalDays from now
    const nextRun = new Date(
      Date.now() + job.intervalDays * 86_400_000
    );
    await db.update(automationJobs)
      .set({ nextRunAt: nextRun.toISOString() })
      .where(eq(automationJobs.id, jobId));
    delayMs = job.intervalDays * 86_400_000;
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

  // Find next scheduled run
  let nextRun: string | null = null;
  for (const job of allJobs) {
    if (job.isActive && job.nextRunAt) {
      if (!nextRun || job.nextRunAt < nextRun) {
        nextRun = job.nextRunAt;
      }
    }
  }

  // Today's sent email count
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

  logger.info(`Executando automacao "${job.name}" (id=${jobId})...`);

  // Create run log
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
    // 1. Gather recipients
    interface Recipient {
      email: string;
      cnpj: string;
      empresa: string;
      cnaePrincipal: string | null;
      emailCategory: string;
      municipio: string | null;
      uf: string | null;
      valor: string;
    }

    const recipientMap = new Map<string, Recipient>();

    // Source: PNCP search
    if (job.sourceType === "search" || job.sourceType === "both") {
      try {
        const searchResult = await runEmailSearch({
          q: job.searchKeyword,
          uf: job.searchUf ?? undefined,
          minResultados: job.searchQuantity,
        });

        for (const f of searchResult.data) {
          if (f.email && !recipientMap.has(f.email.toLowerCase())) {
            recipientMap.set(f.email.toLowerCase(), {
              email: f.email,
              cnpj: f.cnpj,
              empresa: f.razaoSocial || f.nomeFantasia || "",
              cnaePrincipal: f.cnaePrincipal,
              emailCategory: f.emailCategory,
              municipio: f.municipio,
              uf: f.uf,
              valor: f.valorHomologado
                ? `R$ ${f.valorHomologado.toLocaleString("pt-BR")}`
                : "",
            });
          }
        }
      } catch (err: any) {
        logger.error(`Automation search error: ${err.message}`);
      }
    }

    // Source: existing fornecedores
    if (job.sourceType === "fornecedores" || job.sourceType === "both") {
      const dbFornecedores = await db
        .select()
        .from(fornecedores)
        .where(isNotNull(fornecedores.email));

      for (const f of dbFornecedores) {
        if (f.email && !recipientMap.has(f.email.toLowerCase())) {
          recipientMap.set(f.email.toLowerCase(), {
            email: f.email,
            cnpj: f.cnpj,
            empresa: f.razaoSocial || f.nomeFantasia || "",
            cnaePrincipal: f.cnaePrincipal,
            emailCategory: f.emailCategory || "empresa",
            municipio: f.municipio,
            uf: f.uf,
            valor: "",
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

    // 4. Deduplicate against already-sent emails for this template
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

    // 5. Apply max limit
    recipients = recipients.slice(0, job.maxEmailsPerRun);

    // 6. Send emails
    if (
      recipients.length > 0 &&
      job.gmailAccountId &&
      job.templateId
    ) {
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
          job.gmailAccountId,
          job.templateId,
          r.email,
          r.cnpj,
          vars
        );

        if (result.success) emailsSent++;
        else emailsFailed++;

        // 1 second delay between sends
        if (i < recipients.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    // 7. Update run log
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

    // 8. Update job
    const nextRun = new Date(
      Date.now() + job.intervalDays * 86_400_000
    );
    const stats = JSON.stringify({
      emailsFound,
      emailsSent,
      emailsFailed,
      emailsSkipped,
    });

    await db.update(automationJobs)
      .set({
        lastRunAt: now,
        nextRunAt: nextRun.toISOString(),
        lastRunStatus:
          emailsFailed > 0 && emailsSent === 0 ? "failed" : "success",
        lastRunStats: stats,
        updatedAt: now,
      })
      .where(eq(automationJobs.id, jobId));

    logger.info(
      `Automacao "${job.name}" concluida: ${emailsSent} enviados, ${emailsFailed} falharam, ${emailsSkipped} ignorados`
    );
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
    const nextRun = new Date(
      Date.now() + job.intervalDays * 86_400_000
    );
    await db.update(automationJobs)
      .set({
        lastRunAt: now,
        nextRunAt: nextRun.toISOString(),
        lastRunStatus: "failed",
        lastRunStats: JSON.stringify({
          emailsFound,
          emailsSent,
          emailsFailed,
          emailsSkipped,
        }),
        updatedAt: now,
      })
      .where(eq(automationJobs.id, jobId));
  }

  // 9. Reschedule
  await scheduleJob(jobId);
}
