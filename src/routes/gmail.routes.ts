import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import { db } from "../config/database.js";
import { gmailAccounts, emailTemplates, emailSendLog } from "../db/schema.js";
import { env } from "../config/env.js";
import {
  getAuthUrl,
  handleCallback,
  sendEmail,
} from "../services/gmail.service.js";

export async function gmailRoutes(app: FastifyInstance) {
  // Check if Gmail is configured
  app.get("/api/gmail/status", async () => {
    const configured = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
    const accounts = configured
      ? db
          .select({
            id: gmailAccounts.id,
            email: gmailAccounts.email,
            displayName: gmailAccounts.displayName,
            isActive: gmailAccounts.isActive,
            dailySentCount: gmailAccounts.dailySentCount,
          })
          .from(gmailAccounts)
          .all()
      : [];
    return { configured, accounts };
  });

  // Start OAuth flow
  app.get("/api/gmail/auth", async (request, reply) => {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return reply.status(400).send({ error: "Google OAuth nao configurado" });
    }
    const url = getAuthUrl();
    return reply.redirect(url);
  });

  // OAuth callback
  app.get<{ Querystring: { code?: string; error?: string } }>(
    "/api/gmail/callback",
    async (request, reply) => {
      if (request.query.error) {
        return reply.redirect(
          "/?gmail=error&msg=" + encodeURIComponent(request.query.error)
        );
      }
      const code = request.query.code;
      if (!code) {
        return reply.redirect("/?gmail=error&msg=no_code");
      }
      try {
        const result = await handleCallback(code);
        return reply.redirect(
          "/?gmail=success&email=" + encodeURIComponent(result.email)
        );
      } catch (err: any) {
        return reply.redirect(
          "/?gmail=error&msg=" + encodeURIComponent(err.message)
        );
      }
    }
  );

  // Disconnect Gmail account
  app.delete<{ Params: { id: string } }>(
    "/api/gmail/accounts/:id",
    async (request) => {
      const id = Number(request.params.id);
      db.update(gmailAccounts)
        .set({ isActive: false, updatedAt: new Date().toISOString() })
        .where(eq(gmailAccounts.id, id))
        .run();
      return { success: true };
    }
  );

  // ============ TEMPLATES ============

  // List templates
  app.get("/api/gmail/templates", async () => {
    return db.select().from(emailTemplates).all();
  });

  // Create template
  app.post<{
    Body: {
      name: string;
      subject: string;
      body: string;
      targetCategory?: string;
    };
  }>("/api/gmail/templates", async (request) => {
    const { name, subject, body, targetCategory } = request.body;
    const result = db
      .insert(emailTemplates)
      .values({
        name,
        subject,
        body,
        targetCategory: targetCategory || null,
      })
      .run();
    return { id: Number(result.lastInsertRowid), success: true };
  });

  // Update template
  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      subject?: string;
      body?: string;
      targetCategory?: string;
    };
  }>("/api/gmail/templates/:id", async (request) => {
    const id = Number(request.params.id);
    const { name, subject, body, targetCategory } = request.body;
    const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (subject !== undefined) updates.subject = subject;
    if (body !== undefined) updates.body = body;
    if (targetCategory !== undefined) updates.targetCategory = targetCategory || null;

    db.update(emailTemplates)
      .set(updates)
      .where(eq(emailTemplates.id, id))
      .run();
    return { success: true };
  });

  // Delete template
  app.delete<{ Params: { id: string } }>(
    "/api/gmail/templates/:id",
    async (request) => {
      const id = Number(request.params.id);
      db.delete(emailTemplates).where(eq(emailTemplates.id, id)).run();
      return { success: true };
    }
  );

  // ============ SEND EMAILS ============

  // Send to multiple leads
  app.post<{
    Body: {
      accountId: number;
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
  }>("/api/gmail/send", async (request) => {
    const { accountId, templateId, leads } = request.body;

    const results: Array<{
      email: string;
      success: boolean;
      error?: string;
    }> = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
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
        accountId,
        templateId,
        lead.email,
        lead.cnpj ?? null,
        vars
      );
      results.push({ email: lead.email, ...result });

      if (result.success) successCount++;
      else failCount++;

      // 1 second delay between sends
      if (i < leads.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return { results, successCount, failCount, total: leads.length };
  });

  // Send history
  app.get<{
    Querystring: { pagina?: string; tamanhoPagina?: string };
  }>("/api/gmail/send-log", async (request) => {
    const page = Number(request.query.pagina ?? 1);
    const pageSize = Number(request.query.tamanhoPagina ?? 50);
    const offset = (page - 1) * pageSize;

    const logs = db
      .select()
      .from(emailSendLog)
      .orderBy(desc(emailSendLog.sentAt))
      .limit(pageSize)
      .offset(offset)
      .all();

    return { data: logs, page, pageSize };
  });

  // ============ TEST EMAIL ============

  // Send test email
  app.post<{
    Body: {
      accountId: number;
      templateId: number;
      testEmail: string;
    };
  }>("/api/gmail/send-test", async (request) => {
    const { accountId, templateId, testEmail } = request.body;

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
      accountId,
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
  }>("/api/gmail/preview-template", async (request) => {
    const { templateId } = request.body;

    const template = db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, templateId))
      .get();
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

    const { renderTemplate } = await import("../services/gmail.service.js");
    const renderedSubject = renderTemplate(template.subject, vars);
    const renderedBody = renderTemplate(template.body, vars);

    return {
      subject: renderedSubject,
      body: renderedBody,
      templateName: template.name,
    };
  });
}
