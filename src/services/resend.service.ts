import { Resend } from "resend";
import { eq, sql } from "drizzle-orm";
import { db } from "../config/database.js";
import { emailSendLog, emailTemplates, leads } from "../db/schema.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let resendClient: Resend | null = null;

function getClient(): Resend {
  if (!resendClient) {
    if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY nao configurada");
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
}

export function isConfigured(): boolean {
  return !!env.RESEND_API_KEY;
}

export async function getStatus() {
  const today = new Date().toISOString().split("T")[0];
  const allSent = await db
    .select()
    .from(emailSendLog)
    .where(eq(emailSendLog.status, "sent"));
  const todaySent = allSent.filter((l) => l.sentAt?.startsWith(today)).length;

  return {
    configured: !!env.RESEND_API_KEY,
    provider: "resend",
    fromEmail: env.RESEND_FROM_EMAIL,
    fromName: env.RESEND_FROM_NAME,
    todaySent,
    totalSent: allSent.length,
  };
}

export function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}

export async function sendEmail(
  templateId: number,
  recipientEmail: string,
  recipientCnpj: string | null,
  templateVars: Record<string, string>
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const client = getClient();

    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, templateId));
    if (!template) return { success: false, error: "Template nao encontrado" };

    const subject = renderTemplate(template.subject, templateVars);
    const body = renderTemplate(template.body, templateVars);

    const sendPayload: any = {
      from: `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>`,
      to: [recipientEmail],
      subject,
      html: body,
    };
    if (env.RESEND_REPLY_TO) {
      sendPayload.replyTo = env.RESEND_REPLY_TO;
    }

    const { data, error } = await client.emails.send(sendPayload);

    if (error) {
      logger.error(`Resend error: ${error.message}`);
      await db.insert(emailSendLog).values({
        gmailAccountId: null,
        templateId,
        recipientEmail,
        recipientCnpj,
        recipientName: templateVars.empresa ?? null,
        subject,
        status: "failed",
        errorMessage: error.message,
      });
      return { success: false, error: error.message };
    }

    const messageId = data?.id ?? null;

    await db.insert(emailSendLog).values({
      gmailAccountId: null,
      templateId,
      recipientEmail,
      recipientCnpj,
      recipientName: templateVars.empresa ?? null,
      subject,
      status: "sent",
      resendMessageId: messageId,
    });

    // Update lead email tracking
    if (recipientCnpj) {
      const cnpj = recipientCnpj.replace(/\D/g, "");
      if (cnpj) {
        await db
          .update(leads)
          .set({
            emailSentAt: new Date().toISOString(),
            emailSentCount: sql`${leads.emailSentCount} + 1`,
          })
          .where(eq(leads.cnpj, cnpj));
      }
    }

    return { success: true, messageId: messageId ?? undefined };
  } catch (err: any) {
    logger.error(`Resend send error: ${err.message}`);

    try {
      await db.insert(emailSendLog).values({
        gmailAccountId: null,
        templateId,
        recipientEmail,
        recipientCnpj,
        recipientName: templateVars.empresa ?? null,
        subject: "error",
        status: "failed",
        errorMessage: err.message,
      });
    } catch {
      // ignore logging errors
    }

    return { success: false, error: err.message };
  }
}
