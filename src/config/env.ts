import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_PATH: z.string().default("./data/procura.db"),
  CNPJ_CACHE_TTL_DAYS: z.coerce.number().default(30),
});

export const env = envSchema.parse(process.env);
