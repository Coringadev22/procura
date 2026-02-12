import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "./env.js";
import * as schema from "../db/schema.js";

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_URL.includes("railway") ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
export { pool };
