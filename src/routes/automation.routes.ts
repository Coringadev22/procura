import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import { db } from "../config/database.js";
import { automationJobs, automationRunLog } from "../db/schema.js";
import {
  scheduleJob,
  cancelJob,
  executeJob,
  getSchedulerStatus,
} from "../services/automation.service.js";
import { getAvailableSources } from "../services/data-sources/index.js";

export async function automationRoutes(app: FastifyInstance) {
  // List available data sources
  app.get("/api/data-sources", async () => {
    return getAvailableSources();
  });

  // Get scheduler status
  app.get("/api/automation/status", async () => {
    return await getSchedulerStatus();
  });

  // List all jobs
  app.get("/api/automation/jobs", async () => {
    return await db
      .select()
      .from(automationJobs)
      .orderBy(desc(automationJobs.createdAt));
  });

  // Get single job with recent logs
  app.get<{ Params: { id: string } }>(
    "/api/automation/jobs/:id",
    async (request) => {
      const id = Number(request.params.id);
      const [job] = await db
        .select()
        .from(automationJobs)
        .where(eq(automationJobs.id, id));
      if (!job) return { error: "Job nao encontrado" };

      const logs = await db
        .select()
        .from(automationRunLog)
        .where(eq(automationRunLog.jobId, id))
        .orderBy(desc(automationRunLog.startedAt))
        .limit(10);

      return { job, logs };
    }
  );

  // Create job
  app.post<{
    Body: {
      name: string;
      jobType?: string;
      searchKeyword?: string;
      searchUf?: string;
      searchQuantity?: number;
      searchCnae?: string;
      templateId?: number;
      gmailAccountId?: number;
      targetCategory?: string;
      sourceType?: string;
      intervalHours?: number;
      intervalDays?: number;
      maxEmailsPerRun?: number;
    };
  }>("/api/automation/jobs", async (request) => {
    const body = request.body;
    const [result] = await db
      .insert(automationJobs)
      .values({
        name: body.name,
        jobType: body.jobType || "email_send",
        searchKeyword: body.searchKeyword || "",
        searchUf: body.searchUf || null,
        searchQuantity: body.searchQuantity || 20,
        searchCnae: body.searchCnae || null,
        templateId: body.templateId || null,
        gmailAccountId: body.gmailAccountId || null,
        targetCategory: body.targetCategory || "all",
        sourceType: body.sourceType || "search",
        intervalHours: body.intervalHours || (body.intervalDays ? body.intervalDays * 24 : 24),
        maxEmailsPerRun: body.maxEmailsPerRun || 50,
      })
      .returning({ id: automationJobs.id });

    return { id: result.id, success: true };
  });

  // Update job
  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      jobType?: string;
      searchKeyword?: string;
      searchUf?: string;
      searchQuantity?: number;
      searchCnae?: string;
      templateId?: number;
      gmailAccountId?: number;
      targetCategory?: string;
      sourceType?: string;
      intervalHours?: number;
      maxEmailsPerRun?: number;
    };
  }>("/api/automation/jobs/:id", async (request) => {
    const id = Number(request.params.id);
    const body = request.body;
    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.name !== undefined) updates.name = body.name;
    if (body.jobType !== undefined) updates.jobType = body.jobType;
    if (body.searchKeyword !== undefined)
      updates.searchKeyword = body.searchKeyword;
    if (body.searchUf !== undefined)
      updates.searchUf = body.searchUf || null;
    if (body.searchQuantity !== undefined)
      updates.searchQuantity = body.searchQuantity;
    if (body.searchCnae !== undefined)
      updates.searchCnae = body.searchCnae || null;
    if (body.templateId !== undefined)
      updates.templateId = body.templateId || null;
    if (body.gmailAccountId !== undefined)
      updates.gmailAccountId = body.gmailAccountId || null;
    if (body.targetCategory !== undefined)
      updates.targetCategory = body.targetCategory;
    if (body.sourceType !== undefined) updates.sourceType = body.sourceType;
    if (body.intervalHours !== undefined)
      updates.intervalHours = body.intervalHours;
    if (body.maxEmailsPerRun !== undefined)
      updates.maxEmailsPerRun = body.maxEmailsPerRun;

    await db.update(automationJobs)
      .set(updates)
      .where(eq(automationJobs.id, id));

    return { success: true };
  });

  // Delete job
  app.delete<{ Params: { id: string } }>(
    "/api/automation/jobs/:id",
    async (request) => {
      const id = Number(request.params.id);
      cancelJob(id);

      // Delete run logs first
      await db.delete(automationRunLog)
        .where(eq(automationRunLog.jobId, id));

      await db.delete(automationJobs)
        .where(eq(automationJobs.id, id));

      return { success: true };
    }
  );

  // Start job
  app.post<{ Params: { id: string } }>(
    "/api/automation/jobs/:id/start",
    async (request) => {
      const id = Number(request.params.id);
      const now = new Date().toISOString();
      const [job] = await db
        .select()
        .from(automationJobs)
        .where(eq(automationJobs.id, id));

      if (!job) return { error: "Job nao encontrado" };

      const nextRun = new Date(
        Date.now() + job.intervalHours * 3_600_000
      );

      await db.update(automationJobs)
        .set({
          isActive: true,
          nextRunAt: nextRun.toISOString(),
          updatedAt: now,
        })
        .where(eq(automationJobs.id, id));

      await scheduleJob(id);
      return { success: true, nextRunAt: nextRun.toISOString() };
    }
  );

  // Pause job
  app.post<{ Params: { id: string } }>(
    "/api/automation/jobs/:id/pause",
    async (request) => {
      const id = Number(request.params.id);
      cancelJob(id);

      await db.update(automationJobs)
        .set({
          isActive: false,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(automationJobs.id, id));

      return { success: true };
    }
  );

  // Run now
  app.post<{ Params: { id: string } }>(
    "/api/automation/jobs/:id/run-now",
    async (request) => {
      const id = Number(request.params.id);
      const [job] = await db
        .select()
        .from(automationJobs)
        .where(eq(automationJobs.id, id));

      if (!job) return { error: "Job nao encontrado" };

      // Execute in background, return immediately
      executeJob(id).catch((err) => {
        // Error handling is done inside executeJob
      });

      return { success: true, message: "Execucao iniciada" };
    }
  );

  // Get job logs
  app.get<{
    Params: { id: string };
    Querystring: { pagina?: string; tamanhoPagina?: string };
  }>("/api/automation/jobs/:id/logs", async (request) => {
    const id = Number(request.params.id);
    const page = Number(request.query.pagina ?? 1);
    const pageSize = Number(request.query.tamanhoPagina ?? 20);
    const offset = (page - 1) * pageSize;

    const logs = await db
      .select()
      .from(automationRunLog)
      .where(eq(automationRunLog.jobId, id))
      .orderBy(desc(automationRunLog.startedAt))
      .limit(pageSize)
      .offset(offset);

    return logs;
  });
}
