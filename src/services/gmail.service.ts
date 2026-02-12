import { google } from "googleapis";
import { eq } from "drizzle-orm";
import { db } from "../config/database.js";
import { gmailAccounts, emailSendLog, emailTemplates } from "../db/schema.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

const DAILY_LIMIT = 450; // Conservative buffer (Gmail allows 500)

function getOAuth2Client() {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(): string {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function handleCallback(code: string): Promise<{ email: string }> {
  const oauth2 = getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 });
  const userInfo = await oauth2Api.userinfo.get();
  const email = userInfo.data.email!;
  const displayName = userInfo.data.name ?? email;

  const existing = db.select().from(gmailAccounts).where(eq(gmailAccounts.email, email)).get();
  const now = new Date().toISOString();

  if (existing) {
    db.update(gmailAccounts)
      .set({
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? existing.refreshToken,
        tokenExpiry: new Date(tokens.expiry_date!).toISOString(),
        displayName,
        isActive: true,
        updatedAt: now,
      })
      .where(eq(gmailAccounts.id, existing.id))
      .run();
  } else {
    db.insert(gmailAccounts)
      .values({
        email,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token!,
        tokenExpiry: new Date(tokens.expiry_date!).toISOString(),
        displayName,
      })
      .run();
  }

  return { email };
}

async function getAuthenticatedClient(accountId: number) {
  const account = db.select().from(gmailAccounts).where(eq(gmailAccounts.id, accountId)).get();
  if (!account) throw new Error("Gmail account not found");

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: new Date(account.tokenExpiry).getTime(),
  });

  // Refresh if token expires within 1 minute
  if (new Date(account.tokenExpiry).getTime() <= Date.now() + 60_000) {
    const { credentials } = await oauth2.refreshAccessToken();
    db.update(gmailAccounts)
      .set({
        accessToken: credentials.access_token!,
        tokenExpiry: new Date(credentials.expiry_date!).toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(gmailAccounts.id, accountId))
      .run();
    oauth2.setCredentials(credentials);
  }

  return { oauth2, account };
}

function checkAndResetDailyLimit(account: typeof gmailAccounts.$inferSelect): boolean {
  const today = new Date().toISOString().split("T")[0];
  if (account.dailySentDate !== today) {
    db.update(gmailAccounts)
      .set({ dailySentCount: 0, dailySentDate: today })
      .where(eq(gmailAccounts.id, account.id))
      .run();
    return true;
  }
  return account.dailySentCount < DAILY_LIMIT;
}

function incrementSentCount(accountId: number) {
  const account = db.select().from(gmailAccounts).where(eq(gmailAccounts.id, accountId)).get();
  if (!account) return;
  const today = new Date().toISOString().split("T")[0];
  const count = account.dailySentDate === today ? account.dailySentCount + 1 : 1;
  db.update(gmailAccounts)
    .set({ dailySentCount: count, dailySentDate: today, updatedAt: new Date().toISOString() })
    .where(eq(gmailAccounts.id, accountId))
    .run();
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}

export async function sendEmail(
  accountId: number,
  templateId: number,
  recipientEmail: string,
  recipientCnpj: string | null,
  templateVars: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { oauth2, account } = await getAuthenticatedClient(accountId);

    if (!checkAndResetDailyLimit(account)) {
      return { success: false, error: "Limite diario de 450 emails atingido" };
    }

    const template = db.select().from(emailTemplates).where(eq(emailTemplates.id, templateId)).get();
    if (!template) return { success: false, error: "Template nao encontrado" };

    const subject = renderTemplate(template.subject, templateVars);
    const body = renderTemplate(template.body, templateVars);

    // Build RFC 2822 message
    const messageParts = [
      `From: ${account.displayName} <${account.email}>`,
      `To: ${recipientEmail}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8",
      "",
      body,
    ];
    const rawMessage = Buffer.from(messageParts.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const gmail = google.gmail({ version: "v1", auth: oauth2 });
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: rawMessage },
    });

    incrementSentCount(accountId);
    db.insert(emailSendLog).values({
      gmailAccountId: accountId,
      templateId,
      recipientEmail,
      recipientCnpj,
      recipientName: templateVars.empresa ?? null,
      subject,
      status: "sent",
    }).run();

    return { success: true };
  } catch (err: any) {
    logger.error(`Gmail send error: ${err.message}`);

    db.insert(emailSendLog).values({
      gmailAccountId: accountId,
      templateId,
      recipientEmail,
      recipientCnpj,
      recipientName: templateVars.empresa ?? null,
      subject: templateVars._renderedSubject ?? "unknown",
      status: "failed",
      errorMessage: err.message,
    }).run();

    return { success: false, error: err.message };
  }
}
