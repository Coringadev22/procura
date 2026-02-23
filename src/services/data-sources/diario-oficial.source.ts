import { lookupMultipleCnpjs } from "../cnpj-lookup.service.js";
import { isValidCnpj } from "../../utils/cnpj.js";
import { logger } from "../../utils/logger.js";
import type { DataSource, DataSourceConfig, SourceResult } from "./types.js";

interface QdGazette {
  territory_id: string;
  territory_name: string;
  state_code: string;
  date: string;
  excerpts: string[];
}

interface QdResponse {
  total_gazettes: number;
  gazettes: QdGazette[];
}

const CNPJ_REGEX = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;
const CPF_REGEX = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;

const BASE_URL = "https://api.queridodiario.ok.org.br";

// Keywords that indicate PF (pessoa física) leads
const PF_KEYWORDS = [
  "processo administrativo disciplinar",
  "PAD",
  "sindicância",
  "sindicancia",
];

function isPfSearch(keyword: string): boolean {
  const kw = keyword.toLowerCase();
  return PF_KEYWORDS.some((pk) => kw.includes(pk.toLowerCase()));
}

function extractCnpjs(text: string): string[] {
  const matches = text.match(CNPJ_REGEX) || [];
  return [...new Set(matches.map((m) => m.replace(/\D/g, "")))]
    .filter((c) => c.length === 14)
    .filter(isValidCnpj); // Validate check digits
}

function extractCpfs(text: string): string[] {
  const matches = text.match(CPF_REGEX) || [];
  return [...new Set(matches.map((m) => m.replace(/\D/g, "")))].filter(
    (c) => c.length === 11
  );
}

/** Extract names near CPFs in PAD context (best effort) */
function extractNameNearCpf(text: string, cpf: string): string | null {
  const cpfFormatted = cpf.replace(
    /(\d{3})(\d{3})(\d{3})(\d{2})/,
    "$1.$2.$3-$4"
  );
  const escaped = cpfFormatted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ\\s]{5,50}),?\\s*(?:CPF|cpf)\\s*(?:n[ºo°.]?\\s*)?${escaped}`,
    ),
    new RegExp(
      `(?:CPF|cpf)\\s*(?:n[ºo°.]?\\s*)?${escaped}\\s*[-–—]?\\s*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ\\s]{5,50})`,
    ),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

export class DiarioOficialSource implements DataSource {
  readonly name = "diario_oficial";
  readonly label = "Diário Oficial (Querido Diário)";

  async fetch(config: DataSourceConfig): Promise<SourceResult[]> {
    const keyword = config.keyword || "homologação adjudicação";
    const size = Math.min(config.quantity || 50, 100);
    const isPf = isPfSearch(keyword);

    // Build search URL
    const params = new URLSearchParams({
      querystring: keyword,
      size: String(size),
      excerpt_size: "2000",
      number_of_excerpts: "3",
      sort_by: "descending_date",
    });

    // Date range: last 30 days by default
    if (config.dataInicial) {
      params.set("published_since", config.dataInicial);
    } else {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
      params.set("published_since", thirtyDaysAgo.toISOString().split("T")[0]);
    }
    if (config.dataFinal) {
      params.set("published_until", config.dataFinal);
    }

    // Filter by state if provided (UF → IBGE territory_id prefix)
    if (config.uf) {
      // We can't filter by state directly, but we'll filter results after
    }

    const url = `${BASE_URL}/gazettes?${params}`;
    logger.info(
      `Diário Oficial: buscando "${keyword}" (PF=${isPf}, size=${size})`
    );

    let response: QdResponse;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) {
        throw new Error(`Querido Diário API: ${res.status} ${res.statusText}`);
      }
      response = (await res.json()) as QdResponse;
    } catch (err: any) {
      logger.error(`Querido Diário API falhou: ${err.message}`);
      throw new Error(`Querido Diário API indisponível: ${err.message}`);
    }

    // Count unique states for diversity logging
    const states = new Set(response.gazettes.map((g) => g.state_code));
    logger.info(
      `Diário Oficial: ${response.total_gazettes} gazetas encontradas, processando ${response.gazettes.length} de ${states.size} estados (${[...states].join(",")})`
    );

    if (isPf) {
      return this.processPfLeads(response.gazettes);
    }
    return this.processPjLeads(response.gazettes, config.uf);
  }

  private async processPjLeads(gazettes: QdGazette[], ufFilter?: string): Promise<SourceResult[]> {
    const cnpjMap = new Map<string, SourceResult>();

    for (const gazette of gazettes) {
      if (ufFilter && gazette.state_code !== ufFilter.toUpperCase()) continue;

      const fullText = gazette.excerpts.join("\n");
      const cnpjs = extractCnpjs(fullText);

      for (const cnpj of cnpjs) {
        if (!cnpjMap.has(cnpj)) {
          cnpjMap.set(cnpj, {
            cnpj,
            uf: gazette.state_code,
            municipio: gazette.territory_name,
            fonte: "diario_oficial",
          });
        }
      }
    }

    logger.info(
      `Diário Oficial PJ: ${cnpjMap.size} CNPJs válidos extraídos`
    );

    // Enrich with CNPJ lookup
    const cnpjs = [...cnpjMap.keys()];
    if (cnpjs.length > 0) {
      logger.info(
        `Diário Oficial PJ: enriquecendo ${cnpjs.length} CNPJs`
      );
      const enriched = await lookupMultipleCnpjs(cnpjs, false);
      for (const [cnpj, d] of enriched) {
        const result = cnpjMap.get(cnpj);
        if (result && d) {
          result.razaoSocial = d.razaoSocial ?? undefined;
          result.email = d.email ?? undefined;
          result.telefones = d.telefones ?? undefined;
          result.cnaePrincipal = d.cnaePrincipal ?? undefined;
          if (d.municipio) result.municipio = d.municipio;
          if (d.uf) result.uf = d.uf;
        }
      }
    }

    // Filter out leads without razaoSocial (invalid or unresolvable CNPJs)
    const results = [...cnpjMap.values()].filter((r) => r.razaoSocial);
    const filtered = cnpjMap.size - results.length;
    if (filtered > 0) {
      logger.info(
        `Diário Oficial PJ: ${filtered} leads removidos (sem razão social após enriquecimento)`
      );
    }

    logger.info(`Diário Oficial PJ: ${results.length} leads finais`);
    return results;
  }

  private async processPfLeads(gazettes: QdGazette[]): Promise<SourceResult[]> {
    const cpfMap = new Map<string, SourceResult>();

    for (const gazette of gazettes) {
      const fullText = gazette.excerpts.join("\n");
      const cpfs = extractCpfs(fullText);

      for (const cpf of cpfs) {
        if (cpfMap.has(cpf)) continue;

        const name = extractNameNearCpf(fullText, cpf);
        cpfMap.set(cpf, {
          cnpj: cpf,
          tipoPessoa: "PF",
          cpf,
          nomeCompleto: name || undefined,
          uf: gazette.state_code,
          municipio: gazette.territory_name,
          fonte: "diario_oficial_pad",
        });
      }
    }

    logger.info(`Diário Oficial PF: ${cpfMap.size} leads extraídos`);
    return [...cpfMap.values()];
  }
}
