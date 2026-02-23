import { lookupMultipleCnpjs } from "../cnpj-lookup.service.js";
import { logger } from "../../utils/logger.js";
import type { DataSource, DataSourceConfig, SourceResult } from "./types.js";

interface CnepRecord {
  id: number;
  dataInicioSancao?: string;
  dataFimSancao?: string;
  tipoSancao?: { descricaoResumida?: string; descricaoPortal?: string };
  orgaoSancionador?: { nome?: string; siglaUf?: string };
  sancionado?: { nome?: string; codigoFormatado?: string };
  pessoa?: {
    cnpjFormatado?: string;
    nome?: string;
    razaoSocialReceita?: string;
    nomeFantasiaReceita?: string;
    tipo?: string; // "J" or "F"
  };
  valorMulta?: string;
}

const API_URL = "https://api.portaldatransparencia.gov.br/api-de-dados/cnep";

export class CnepSource implements DataSource {
  readonly name = "cnep";
  readonly label = "CNEP (Empresas Punidas)";

  async fetch(config: DataSourceConfig): Promise<SourceResult[]> {
    const apiKey = process.env.PORTAL_TRANSPARENCIA_KEY;
    if (!apiKey) {
      throw new Error(
        "Chave da API do Portal da Transparência não configurada. " +
          "Registre em portaldatransparencia.gov.br/api-de-dados/cadastrar-email " +
          "e configure PORTAL_TRANSPARENCIA_KEY"
      );
    }

    const maxPages = Math.ceil((config.quantity || 100) / 15);
    const cnpjMap = new Map<string, SourceResult>();

    logger.info(`CNEP: buscando empresas punidas (max ${maxPages} páginas)`);

    for (let page = 1; page <= maxPages; page++) {
      try {
        const params = new URLSearchParams({ pagina: String(page) });
        const res = await fetch(`${API_URL}?${params}`, {
          headers: {
            "chave-api-dados": apiKey,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(20000),
        });

        if (!res.ok) {
          throw new Error(`CNEP API: ${res.status} ${res.statusText}`);
        }

        const data = (await res.json()) as CnepRecord[];
        if (!Array.isArray(data) || data.length === 0) break;

        for (const record of data) {
          if (record.pessoa?.tipo !== "J") continue;

          const cnpjRaw =
            record.pessoa?.cnpjFormatado?.replace(/\D/g, "") ||
            record.sancionado?.codigoFormatado?.replace(/\D/g, "");
          if (!cnpjRaw || cnpjRaw.length !== 14) continue;

          if (!cnpjMap.has(cnpjRaw)) {
            cnpjMap.set(cnpjRaw, {
              cnpj: cnpjRaw,
              razaoSocial:
                record.pessoa?.razaoSocialReceita ||
                record.sancionado?.nome ||
                undefined,
              uf: record.orgaoSancionador?.siglaUf || undefined,
              fonte: "cnep",
            });
          }
        }

        // Rate limit: 90 req/min → ~670ms between requests
        if (page < maxPages) {
          await new Promise((r) => setTimeout(r, 700));
        }
      } catch (err: any) {
        logger.error(`CNEP page ${page} error: ${err.message}`);
        break;
      }
    }

    // Enrich with email/phone data
    const cnpjs = [...cnpjMap.keys()];
    if (cnpjs.length > 0) {
      logger.info(`CNEP: enriquecendo ${cnpjs.length} CNPJs`);
      const enriched = await lookupMultipleCnpjs(cnpjs, false);
      for (const [cnpj, d] of enriched) {
        const result = cnpjMap.get(cnpj);
        if (result && d) {
          result.email = d.email ?? undefined;
          result.telefones = d.telefones ?? undefined;
          result.cnaePrincipal = d.cnaePrincipal ?? undefined;
          result.municipio = d.municipio ?? undefined;
          if (d.uf) result.uf = d.uf;
        }
      }
    }

    logger.info(`CNEP: ${cnpjMap.size} leads de empresas punidas`);
    return [...cnpjMap.values()];
  }
}
