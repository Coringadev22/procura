import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().default("postgresql://localhost:5432/procura"),
  CNPJ_CACHE_TTL_DAYS: z.coerce.number().default(30),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default("noreply@procura.com"),
  RESEND_FROM_NAME: z.string().default("Procura"),
  RESEND_REPLY_TO: z.string().optional(),
});

export const env = envSchema.parse(process.env);
