import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_PATH: z.string().default("./data/procura.db"),
  CNPJ_CACHE_TTL_DAYS: z.coerce.number().default(30),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().default("http://localhost:3000/api/gmail/callback"),
});

export const env = envSchema.parse(process.env);
