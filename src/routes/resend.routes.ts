import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import { db } from "../config/database.js";
import { emailTemplates, emailSendLog, automationJobs, inboundEmails, leads } from "../db/schema.js";
import {
  isConfigured,
  getStatus,
  sendEmail,
  renderTemplate,
} from "../services/resend.service.js";

export async function resendRoutes(app: FastifyInstance) {
  // ============ STATUS ============

  app.get("/api/email/status", async () => {
    if (!isConfigured()) {
      return { configured: false, provider: "resend" };
    }
    return await getStatus();
  });

  // ============ TEMPLATES ============

  app.get("/api/email/templates", async () => {
    return await db.select().from(emailTemplates);
  });

  app.post<{
    Body: {
      name: string;
      subject: string;
      body: string;
      targetCategory?: string;
    };
  }>("/api/email/templates", async (request) => {
    const { name, subject, body, targetCategory } = request.body;
    const [result] = await db
      .insert(emailTemplates)
      .values({
        name,
        subject,
        body,
        targetCategory: targetCategory || null,
      })
      .returning({ id: emailTemplates.id });
    return { id: result.id, success: true };
  });

  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      subject?: string;
      body?: string;
      targetCategory?: string;
    };
  }>("/api/email/templates/:id", async (request) => {
    const id = Number(request.params.id);
    const { name, subject, body, targetCategory } = request.body;
    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };
    if (name !== undefined) updates.name = name;
    if (subject !== undefined) updates.subject = subject;
    if (body !== undefined) updates.body = body;
    if (targetCategory !== undefined)
      updates.targetCategory = targetCategory || null;

    await db
      .update(emailTemplates)
      .set(updates)
      .where(eq(emailTemplates.id, id));
    return { success: true };
  });

  app.delete<{ Params: { id: string } }>(
    "/api/email/templates/:id",
    async (request) => {
      const id = Number(request.params.id);
      // Remove FK references before deleting
      await db.update(emailSendLog).set({ templateId: null }).where(eq(emailSendLog.templateId, id));
      await db.update(automationJobs).set({ templateId: null }).where(eq(automationJobs.templateId, id));
      await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
      return { success: true };
    }
  );

  // ============ SEND EMAILS ============

  app.post<{
    Body: {
      templateId: number;
      leads: Array<{
        email: string;
        cnpj?: string;
        empresa?: string;
        contato?: string;
        valor?: string;
        cidade?: string;
        uf?: string;
      }>;
    };
  }>("/api/email/send", async (request) => {
    const { templateId, leads: sendLeads } = request.body;

    const results: Array<{
      email: string;
      success: boolean;
      error?: string;
    }> = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < sendLeads.length; i++) {
      const lead = sendLeads[i];
      const vars: Record<string, string> = {
        empresa: lead.empresa ?? "",
        cnpj: lead.cnpj ?? "",
        email: lead.email,
        contato: lead.contato ?? lead.empresa ?? "",
        valor: lead.valor ?? "",
        cidade: lead.cidade ?? "",
        uf: lead.uf ?? "",
      };

      const result = await sendEmail(
        templateId,
        lead.email,
        lead.cnpj ?? null,
        vars
      );
      results.push({ email: lead.email, ...result });

      if (result.success) successCount++;
      else failCount++;

      if (i < sendLeads.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return { results, successCount, failCount, total: sendLeads.length };
  });

  // Send history
  app.get<{
    Querystring: { pagina?: string; tamanhoPagina?: string };
  }>("/api/email/send-log", async (request) => {
    const page = Number(request.query.pagina ?? 1);
    const pageSize = Number(request.query.tamanhoPagina ?? 50);
    const offset = (page - 1) * pageSize;

    const logs = await db
      .select()
      .from(emailSendLog)
      .orderBy(desc(emailSendLog.sentAt))
      .limit(pageSize)
      .offset(offset);

    return { data: logs, page, pageSize };
  });

  // ============ TEST EMAIL ============

  app.post<{
    Body: {
      templateId: number;
      testEmail: string;
    };
  }>("/api/email/send-test", async (request) => {
    const { templateId, testEmail } = request.body;

    const testVars: Record<string, string> = {
      empresa: "Empresa Teste LTDA",
      cnpj: "12.345.678/0001-90",
      email: testEmail,
      contato: "Joao da Silva",
      valor: "R$ 150.000,00",
      cidade: "Sao Paulo",
      uf: "SP",
    };

    const result = await sendEmail(
      templateId,
      testEmail,
      "12345678000190",
      testVars
    );

    return { success: result.success, error: result.error };
  });

  // Preview template (no send)
  app.post<{
    Body: { templateId: number };
  }>("/api/email/preview-template", async (request) => {
    const { templateId } = request.body;

    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, templateId));
    if (!template) return { error: "Template nao encontrado" };

    const vars: Record<string, string> = {
      empresa: "Empresa Teste LTDA",
      cnpj: "12.345.678/0001-90",
      email: "teste@empresa.com",
      contato: "Joao da Silva",
      valor: "R$ 150.000,00",
      cidade: "Sao Paulo",
      uf: "SP",
    };

    const renderedSubject = renderTemplate(template.subject, vars);
    const renderedBody = renderTemplate(template.body, vars);

    return {
      subject: renderedSubject,
      body: renderedBody,
      templateName: template.name,
    };
  });

  // ============ WEBHOOKS ============

  // Resend delivery events webhook
  app.post<{
    Body: {
      type: string;
      data: { email_id?: string };
    };
  }>("/api/email/webhook", async (request) => {
    const event = request.body;
    const messageId = event.data?.email_id;
    if (!messageId) return { ok: true };

    const statusMap: Record<string, string> = {
      "email.delivered": "delivered",
      "email.bounced": "bounced",
      "email.complained": "complained",
      "email.delivery_delayed": "delayed",
    };

    const deliveryStatus = statusMap[event.type];
    if (deliveryStatus) {
      await db
        .update(emailSendLog)
        .set({ deliveryStatus })
        .where(eq(emailSendLog.resendMessageId, messageId));
    }

    return { ok: true };
  });

  // Resend inbound email webhook
  app.post<{
    Body: {
      from: string;
      to: string;
      subject?: string;
      text?: string;
      html?: string;
      headers?: Record<string, string>;
    };
  }>("/api/email/inbound", async (request) => {
    const event = request.body;

    // Try to match sender to a lead by email
    let leadCnpj: string | null = null;
    if (event.from) {
      const fromAddr = event.from
        .replace(/<|>/g, "")
        .trim()
        .toLowerCase();
      const [matchedLead] = await db
        .select()
        .from(leads)
        .where(eq(leads.email, fromAddr));
      if (matchedLead) leadCnpj = matchedLead.cnpj;
    }

    await db.insert(inboundEmails).values({
      fromEmail: event.from || "unknown",
      fromName: null,
      toEmail: event.to || "",
      subject: event.subject || null,
      bodyText: event.text || null,
      bodyHtml: event.html || null,
      leadCnpj,
    });

    return { ok: true };
  });

  // ============ INBOX ============

  app.get("/api/email/inbox", async () => {
    return await db
      .select()
      .from(inboundEmails)
      .orderBy(desc(inboundEmails.receivedAt))
      .limit(100);
  });

  app.patch<{ Params: { id: string } }>(
    "/api/email/inbox/:id/read",
    async (request) => {
      const id = Number(request.params.id);
      await db
        .update(inboundEmails)
        .set({ isRead: true })
        .where(eq(inboundEmails.id, id));
      return { success: true };
    }
  );
}
