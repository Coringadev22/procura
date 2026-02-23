import { lookupMultipleCnpjs } from "../cnpj-lookup.service.js";
import { isValidCnpj } from "../../utils/cnpj.js";
import { logger } from "../../utils/logger.js";
import type { DataSource, DataSourceConfig, SourceResult } from "./types.js";

interface TceSpDespesa {
  orgao?: string;
  mes?: string;
  evento?: string;
  nr_empenho?: string;
  id_fornecedor?: string;
  nm_fornecedor?: string;
  dt_emissao_despesa?: string;
  vl_despesa?: string;
}

// Top municipalities by procurement volume in São Paulo
const TOP_MUNICIPIOS = [
  "campinas",
  "guarulhos",
  "ribeirao-preto",
  "sorocaba",
  "sao-jose-dos-campos",
  "santos",
  "osasco",
  "santo-andre",
  "piracicaba",
  "jundiai",
  "bauru",
  "sao-bernardo-do-campo",
  "franca",
  "marilia",
  "presidente-prudente",
];

const BASE_URL = "https://transparencia.tce.sp.gov.br/api/json";

/** Extract CNPJ from id_fornecedor like "CNPJ - PESSOA JURIDICA - 51885242000140" */
function extractCnpjFromId(idFornecedor: string): string | null {
  if (!idFornecedor) return null;
  // Match 14-digit CNPJ at the end of the string
  const match = idFornecedor.match(/(\d{14})\s*$/);
  if (match) return match[1];
  // Or extract any 14-digit sequence
  const digits = idFornecedor.replace(/\D/g, "");
  return digits.length === 14 ? digits : null;
}

/** Parse Brazilian number format "43571,08" → 43571.08 */
function parseBrValue(val: string): number | null {
  if (!val) return null;
  const num = parseFloat(val.replace(/\./g, "").replace(",", "."));
  return isNaN(num) ? null : num;
}

export class TceSpSource implements DataSource {
  readonly name = "tce_sp";
  readonly label = "TCE-SP (Despesas)";

  async fetch(config: DataSourceConfig): Promise<SourceResult[]> {
    const limit = config.quantity || 50;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() || 12; // Previous month (0-indexed, so January→12 of prev year)
    const targetYear = now.getMonth() === 0 ? year - 1 : year;

    // Pick municipalities to search (up to 3 to stay within limits)
    const municipiosToSearch = TOP_MUNICIPIOS.slice(0, 3);

    logger.info(
      `TCE-SP: buscando despesas de ${municipiosToSearch.length} municípios (${targetYear}/${month})`
    );

    const cnpjMap = new Map<string, SourceResult>();

    for (const municipio of municipiosToSearch) {
      try {
        const url = `${BASE_URL}/despesas/${municipio}/${targetYear}/${month}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(20000) });

        if (!res.ok) {
          logger.warn(`TCE-SP ${municipio}: ${res.status}`);
          continue;
        }

        const data = (await res.json()) as TceSpDespesa[];
        if (!Array.isArray(data)) continue;

        for (const d of data) {
          if (!d.id_fornecedor) continue;
          const cnpj = extractCnpjFromId(d.id_fornecedor);
          if (!cnpj || !isValidCnpj(cnpj)) continue;

          if (!cnpjMap.has(cnpj)) {
            cnpjMap.set(cnpj, {
              cnpj,
              razaoSocial: d.nm_fornecedor || undefined,
              uf: "SP",
              municipio: municipio.replace(/-/g, " "),
              valorHomologado: parseBrValue(d.vl_despesa || "") ?? undefined,
              fonte: "tce_sp",
            });
          }

          // Stop if we have enough
          if (cnpjMap.size >= limit) break;
        }

        logger.info(
          `TCE-SP ${municipio}: ${data.length} despesas → ${cnpjMap.size} CNPJs únicos`
        );
      } catch (err: any) {
        logger.warn(`TCE-SP ${municipio} error: ${err.message}`);
      }

      if (cnpjMap.size >= limit) break;
    }

    // Enrich with email/phone data
    const cnpjs = [...cnpjMap.keys()].slice(0, limit);
    if (cnpjs.length > 0) {
      logger.info(`TCE-SP: enriquecendo ${cnpjs.length} CNPJs`);
      const enriched = await lookupMultipleCnpjs(cnpjs, false);
      for (const [cnpj, d] of enriched) {
        const result = cnpjMap.get(cnpj);
        if (result && d) {
          result.email = d.email ?? undefined;
          result.telefones = d.telefones ?? undefined;
          result.cnaePrincipal = d.cnaePrincipal ?? undefined;
          if (d.municipio) result.municipio = d.municipio;
          if (d.razaoSocial) result.razaoSocial = d.razaoSocial;
        }
      }
    }

    const results = [...cnpjMap.values()].slice(0, limit);
    logger.info(`TCE-SP: ${results.length} leads finais`);
    return results;
  }
}
