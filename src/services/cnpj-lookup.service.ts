import PQueue from "p-queue";
import { eq } from "drizzle-orm";
import { db } from "../config/database.js";
import { fornecedores } from "../db/schema.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { cleanCnpj } from "../utils/cnpj.js";
import { fetchWithRetry } from "../utils/retry.js";
import { detectEmailCategory } from "../utils/email-category.js";
import type {
  CnpjData,
  BrasilApiCnpjResponse,
  CnpjaResponse,
  CnpjWsResponse,
  ReceitaWsResponse,
} from "../types/cnpj.types.js";

// Rate-limited queues for external APIs
// BrasilAPI: no strict rate limit, fast for company data (no emails)
const brasilApiQueue = new PQueue({
  concurrency: 5,
  intervalCap: 20,
  interval: 1000,
});

// 2 primary email providers (company emails, higher quality)
// CNPJá open: ~3 req/min - HAS emails (empresa quality)
const cnpjaQueue = new PQueue({
  concurrency: 1,
  intervalCap: 3,
  interval: 60_000,
});

// CNPJ.ws: ~2 req/min - HAS emails (empresa quality)
const cnpjWsQueue = new PQueue({
  concurrency: 1,
  intervalCap: 2,
  interval: 60_000,
});

// ReceitaWS: ~3 req/min - LAST RESORT (often returns accounting firm emails)
const receitawsQueue = new PQueue({
  concurrency: 1,
  intervalCap: 3,
  interval: 60_000,
});

function isCacheValid(lastLookupAt: string | null): boolean {
  if (!lastLookupAt) return false;
  const ttlMs = env.CNPJ_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(lastLookupAt).getTime() < ttlMs;
}

async function fetchBrasilApi(cnpj: string): Promise<CnpjData | null> {
  try {
    const res = await fetchWithRetry(
      `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
      undefined,
      2
    );

    if (!res.ok) return null;

    const data = (await res.json()) as BrasilApiCnpjResponse;

    const phones = [data.ddd_telefone_1, data.ddd_telefone_2]
      .filter(Boolean)
      .join(", ");

    return {
      cnpj: cleanCnpj(data.cnpj ?? cnpj),
      razaoSocial: data.razao_social ?? null,
      nomeFantasia: data.nome_fantasia ?? null,
      email: null, // BrasilAPI doesn't reliably return emails
      telefones: phones || null,
      logradouro: data.logradouro ?? null,
      municipio: data.municipio ?? null,
      uf: data.uf ?? null,
      cep: data.cep ?? null,
      cnaePrincipal: data.cnae_fiscal_descricao ?? null,
      situacaoCadastral: data.descricao_situacao_cadastral ?? null,
      emailSource: "not_found",
      emailCategory: "empresa",
    };
  } catch (err) {
    logger.error(`BrasilAPI error for ${cnpj}: ${err}`);
    return null;
  }
}

// Email-only fetchers for each provider
async function fetchCnpjaEmail(cnpj: string): Promise<string | null> {
  try {
    const res = await fetchWithRetry(
      `https://open.cnpja.com/office/${cnpj}`,
      undefined,
      1
    );
    if (!res.ok) return null;
    const data = (await res.json()) as CnpjaResponse;
    return data.emails?.[0]?.address || null;
  } catch (err) {
    logger.error(`CNPJá error for ${cnpj}: ${err}`);
    return null;
  }
}

async function fetchCnpjWsEmail(cnpj: string): Promise<string | null> {
  try {
    const res = await fetchWithRetry(
      `https://publica.cnpj.ws/cnpj/${cnpj}`,
      undefined,
      1
    );
    if (!res.ok) return null;
    const data = (await res.json()) as CnpjWsResponse;
    return data.estabelecimento?.email || null;
  } catch (err) {
    logger.error(`CNPJ.ws error for ${cnpj}: ${err}`);
    return null;
  }
}

async function fetchReceitaWsEmail(cnpj: string): Promise<string | null> {
  try {
    const res = await fetchWithRetry(
      `https://receitaws.com.br/v1/cnpj/${cnpj}`,
      undefined,
      1
    );
    if (!res.ok) return null;
    const data = (await res.json()) as ReceitaWsResponse;
    if (data.status === "ERROR") return null;
    return data.email || null;
  } catch (err) {
    logger.error(`ReceitaWS error for ${cnpj}: ${err}`);
    return null;
  }
}

async function upsertCache(cnpj: string, result: CnpjData, cached: typeof fornecedores.$inferSelect | undefined) {
  const now = new Date().toISOString();
  if (cached) {
    await db.update(fornecedores)
      .set({
        razaoSocial: result.razaoSocial,
        nomeFantasia: result.nomeFantasia,
        email: result.email,
        telefones: result.telefones,
        logradouro: result.logradouro,
        municipio: result.municipio,
        uf: result.uf,
        cep: result.cep,
        cnaePrincipal: result.cnaePrincipal,
        situacaoCadastral: result.situacaoCadastral,
        emailSource: result.emailSource,
        emailCategory: result.emailCategory,
        lastLookupAt: now,
        updatedAt: now,
      })
      .where(eq(fornecedores.cnpj, cnpj));
  } else {
    await db.insert(fornecedores)
      .values({
        cnpj,
        razaoSocial: result.razaoSocial,
        nomeFantasia: result.nomeFantasia,
        email: result.email,
        telefones: result.telefones,
        logradouro: result.logradouro,
        municipio: result.municipio,
        uf: result.uf,
        cep: result.cep,
        cnaePrincipal: result.cnaePrincipal,
        situacaoCadastral: result.situacaoCadastral,
        emailSource: result.emailSource,
        emailCategory: result.emailCategory,
        lastLookupAt: now,
      });
  }
}

export async function lookupCnpj(rawCnpj: string, skipSlowFallback = false): Promise<CnpjData> {
  const cnpj = cleanCnpj(rawCnpj);

  // 1. Check cache
  const [cached] = await db
    .select()
    .from(fornecedores)
    .where(eq(fornecedores.cnpj, cnpj));

  if (cached && isCacheValid(cached.lastLookupAt)) {
    return {
      cnpj: cached.cnpj,
      razaoSocial: cached.razaoSocial,
      nomeFantasia: cached.nomeFantasia,
      email: cached.email,
      telefones: cached.telefones,
      logradouro: cached.logradouro,
      municipio: cached.municipio,
      uf: cached.uf,
      cep: cached.cep,
      cnaePrincipal: cached.cnaePrincipal,
      situacaoCadastral: cached.situacaoCadastral,
      emailSource: (cached.emailSource as CnpjData["emailSource"]) ?? "not_found",
      emailCategory: (cached.emailCategory as CnpjData["emailCategory"]) ?? "empresa",
    };
  }

  // 2. Get company data from BrasilAPI (fast)
  let result = await brasilApiQueue.add(() => fetchBrasilApi(cnpj));

  if (!result) {
    result = {
      cnpj,
      razaoSocial: null,
      nomeFantasia: null,
      email: null,
      telefones: null,
      logradouro: null,
      municipio: null,
      uf: null,
      cep: null,
      cnaePrincipal: null,
      situacaoCadastral: null,
      emailSource: "lookup_failed",
      emailCategory: "empresa",
    };
  }

  if (skipSlowFallback) {
    return result;
  }

  // 3. Get email from CNPJá (best quality - empresa emails)
  let primaryEmail: string | null = null;
  if (!result.email) {
    const email = await cnpjaQueue.add(() => fetchCnpjaEmail(cnpj));
    if (email) {
      result.email = email;
      result.emailSource = "cnpja";
      primaryEmail = email;
    }
  }

  // 4. Fallback to CNPJ.ws (good quality - empresa emails)
  if (!result.email) {
    const email = await cnpjWsQueue.add(() => fetchCnpjWsEmail(cnpj));
    if (email) {
      result.email = email;
      result.emailSource = "cnpjws";
      primaryEmail = email;
    }
  }

  // 5. Last resort: ReceitaWS (often returns accounting firm emails)
  if (!result.email) {
    const email = await receitawsQueue.add(() => fetchReceitaWsEmail(cnpj));
    if (email) {
      result.email = email;
      result.emailSource = "receitaws";
    }
  }

  // 6. Classify email category using 3-layer detection
  result.emailCategory = detectEmailCategory(result.email, result.emailSource, primaryEmail);

  await upsertCache(cnpj, result, cached);
  return result;
}

/**
 * Bulk lookup: uses BrasilAPI for data + 2-pass email strategy
 * Pass 1: CNPJá + CNPJ.ws (empresa quality, ~5 emails/min)
 * Pass 2: ReceitaWS fallback for remaining (often contabilidade, ~3 emails/min)
 */
export async function lookupMultipleCnpjs(
  cnpjs: string[],
  skipSlowFallback = false
): Promise<Map<string, CnpjData>> {
  const results = new Map<string, CnpjData>();
  const unique = [...new Set(cnpjs.map(cleanCnpj))];

  logger.info(`Looking up ${unique.length} unique CNPJs (skipSlowFallback=${skipSlowFallback})`);

  // Step 1: Check cache for all CNPJs
  const needsLookup: string[] = [];
  for (const cnpj of unique) {
    const [cached] = await db
      .select()
      .from(fornecedores)
      .where(eq(fornecedores.cnpj, cnpj));

    if (cached && isCacheValid(cached.lastLookupAt)) {
      results.set(cnpj, {
        cnpj: cached.cnpj,
        razaoSocial: cached.razaoSocial,
        nomeFantasia: cached.nomeFantasia,
        email: cached.email,
        telefones: cached.telefones,
        logradouro: cached.logradouro,
        municipio: cached.municipio,
        uf: cached.uf,
        cep: cached.cep,
        cnaePrincipal: cached.cnaePrincipal,
        situacaoCadastral: cached.situacaoCadastral,
        emailSource: (cached.emailSource as CnpjData["emailSource"]) ?? "not_found",
        emailCategory: (cached.emailCategory as CnpjData["emailCategory"]) ?? "empresa",
      });
    } else {
      needsLookup.push(cnpj);
    }
  }

  logger.info(`${results.size} cache hits, ${needsLookup.length} need lookup`);

  if (needsLookup.length === 0) return results;

  // Step 2: Get company data from BrasilAPI for all (fast, parallel)
  const brasilData = new Map<string, CnpjData>();
  await Promise.all(
    needsLookup.map(async (cnpj) => {
      const data = await brasilApiQueue.add(() => fetchBrasilApi(cnpj));
      brasilData.set(cnpj, data ?? {
        cnpj,
        razaoSocial: null,
        nomeFantasia: null,
        email: null,
        telefones: null,
        logradouro: null,
        municipio: null,
        uf: null,
        cep: null,
        cnaePrincipal: null,
        situacaoCadastral: null,
        emailSource: "not_found" as const,
        emailCategory: "empresa" as const,
      });
    })
  );

  if (skipSlowFallback) {
    for (const [cnpj, data] of brasilData) {
      const [cached] = await db.select().from(fornecedores).where(eq(fornecedores.cnpj, cnpj));
      if (cached) {
        await db.update(fornecedores)
          .set({
            razaoSocial: data.razaoSocial,
            nomeFantasia: data.nomeFantasia,
            telefones: data.telefones,
            logradouro: data.logradouro,
            municipio: data.municipio,
            uf: data.uf,
            cep: data.cep,
            cnaePrincipal: data.cnaePrincipal,
            situacaoCadastral: data.situacaoCadastral,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(fornecedores.cnpj, cnpj));
      } else {
        await db.insert(fornecedores)
          .values({
            cnpj,
            razaoSocial: data.razaoSocial,
            nomeFantasia: data.nomeFantasia,
            telefones: data.telefones,
            logradouro: data.logradouro,
            municipio: data.municipio,
            uf: data.uf,
            cep: data.cep,
            cnaePrincipal: data.cnaePrincipal,
            situacaoCadastral: data.situacaoCadastral,
            emailSource: "not_found",
            emailCategory: "empresa",
          });
      }
      results.set(cnpj, data);
    }
    return results;
  }

  // Step 3: PASS 1 — Get emails from CNPJá + CNPJ.ws (empresa quality)
  const needsEmail = needsLookup.filter((cnpj) => !brasilData.get(cnpj)?.email);

  logger.info(`Pass 1: ${needsEmail.length} CNPJs need email (CNPJá + CNPJ.ws)`);

  const emailResults = new Map<string, { email: string; source: CnpjData["emailSource"] }>();

  const pass1Lookups = needsEmail.map(async (cnpj, index) => {
    const provider = index % 2; // Only 2 providers in pass 1
    let email: string | null = null;
    let source: CnpjData["emailSource"] = "not_found";

    if (provider === 0) {
      email = await cnpjaQueue.add(() => fetchCnpjaEmail(cnpj));
      source = "cnpja";
    } else {
      email = await cnpjWsQueue.add(() => fetchCnpjWsEmail(cnpj));
      source = "cnpjws";
    }

    if (email) {
      emailResults.set(cnpj, { email, source });
    }
  });

  await Promise.all(pass1Lookups);

  // Step 4: PASS 2 — ReceitaWS fallback for CNPJs that still have no email
  const stillNoEmail = needsEmail.filter((cnpj) => !emailResults.has(cnpj));

  logger.info(`Pass 2: ${stillNoEmail.length} CNPJs still need email (ReceitaWS fallback)`);

  const pass2Lookups = stillNoEmail.map(async (cnpj) => {
    const email = await receitawsQueue.add(() => fetchReceitaWsEmail(cnpj));
    if (email) {
      emailResults.set(cnpj, { email, source: "receitaws" });
    }
  });

  await Promise.all(pass2Lookups);

  // Step 5: Merge results, classify, and save to cache
  for (const [cnpj, data] of brasilData) {
    const emailResult = emailResults.get(cnpj);
    if (emailResult) {
      data.email = emailResult.email;
      data.emailSource = emailResult.source;
    }

    // Classify using 3-layer detection
    data.emailCategory = detectEmailCategory(data.email, data.emailSource);

    const [cached] = await db.select().from(fornecedores).where(eq(fornecedores.cnpj, cnpj));
    await upsertCache(cnpj, data, cached);
    results.set(cnpj, data);
  }

  return results;
}
