import { db } from "../src/config/database.js";
import { fornecedores } from "../src/db/schema.js";
import { eq } from "drizzle-orm";
import { lookupCnpj } from "../src/services/cnpj-lookup.service.js";

const cnpj = "13574771000134";

// Check cache
const [cached] = await db.select().from(fornecedores).where(eq(fornecedores.cnpj, cnpj));
console.log("Cache exists:", cached ? "YES" : "NO", "| telefones:", cached?.telefones || "NULL", "| lastLookup:", cached?.lastLookupAt);

// Invalidate cache (set lastLookupAt = null so isCacheValid returns false)
if (cached) {
  await db.update(fornecedores)
    .set({ lastLookupAt: null })
    .where(eq(fornecedores.cnpj, cnpj));
  console.log("Cache invalidated (lastLookupAt = null)");
}

// Lookup fresh (should skip cache now)
console.log("Calling lookupCnpj...");
const start = Date.now();
try {
  const data = await lookupCnpj(cnpj);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Result (${elapsed}s):`, JSON.stringify({
    telefones: data.telefones,
    email: data.email,
    razaoSocial: data.razaoSocial,
    emailSource: data.emailSource,
  }));
} catch (err: any) {
  console.error("Error:", err.message);
}

process.exit(0);
