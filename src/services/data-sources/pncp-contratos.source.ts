import { fetchWithRetry } from "../../utils/retry.js";
import { lookupMultipleCnpjs } from "../cnpj-lookup.service.js";
import { logger } from "../../utils/logger.js";
import type { DataSource, DataSourceConfig, SourceResult } from "./types.js";

interface PncpContratoItem {
  niFornecedor: string;
  nomeRazaoSocialFornecedor: string;
  tipoPessoa: string;
  valorGlobal: number;
  unidadeOrgao?: {
    ufSigla?: string;
    municipioNome?: string;
  };
}

interface PncpContratoPageResponse {
  data: PncpContratoItem[];
  totalRegistros: number;
  totalPaginas: number;
}

const CONTRATOS_URL = "https://pncp.gov.br/api/consulta/v1/contratos";

async function fetchContratosPage(
  dataInicial: string,
  dataFinal: string,
  pagina: number,
  tamanhoPagina: number
): Promise<PncpContratoPageResponse> {
  const url = new URL(CONTRATOS_URL);
  url.searchParams.set("dataInicial", dataInicial);
  url.searchParams.set("dataFinal", dataFinal);
  url.searchParams.set("pagina", String(pagina));
  url.searchParams.set("tamanhoPagina", String(tamanhoPagina));

  const res = await fetchWithRetry(url.toString());
  if (!res.ok) {
    throw new Error(`PNCP Contratos API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<PncpContratoPageResponse>;
}

export class PncpContratosSource implements DataSource {
  readonly name = "pncp_contratos";
  readonly label = "PNCP Contratos";

  async fetch(config: DataSourceConfig): Promise<SourceResult[]> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dataFinal =
      config.dataFinal ||
      now.toISOString().slice(0, 10).replace(/-/g, "");
    const dataInicial =
      config.dataInicial ||
      thirtyDaysAgo.toISOString().slice(0, 10).replace(/-/g, "");

    const targetUf = config.uf?.toUpperCase();
    const targetCount = config.quantity || 50;

    logger.info(
      `PncpContratos: buscando contratos ${dataInicial}-${dataFinal} uf=${targetUf || "global"} target=${targetCount}`
    );

    // The PNCP Contratos Consulta API does NOT support UF filtering.
    // Results are ordered by publication date (most recent first) and clustered by org.
    // Strategy: fetch pages globally, extract PJ supplier CNPJs.
    // If UF is specified, we filter client-side but scan more pages to find enough.
    const cnpjMap = new Map<string, SourceResult>();
    const maxPages = targetUf ? 100 : 20; // More pages when filtering by UF
    const pageSize = 100;
    let pagesScanned = 0;
    let totalContratos = 0;

    for (let page = 1; page <= maxPages; page++) {
      let pageData: PncpContratoPageResponse;
      try {
        pageData = await fetchContratosPage(dataInicial, dataFinal, page, pageSize);
      } catch (err: any) {
        logger.error(`PncpContratos page ${page} error: ${err.message}`);
        break;
      }

      if (!pageData.data || pageData.data.length === 0) break;
      pagesScanned++;
      totalContratos += pageData.data.length;

      for (const c of pageData.data) {
        if (c.tipoPessoa !== "PJ") continue;

        const uf = c.unidadeOrgao?.ufSigla;
        if (targetUf && uf !== targetUf) continue;

        const cnpj = c.niFornecedor?.replace(/\D/g, "");
        if (!cnpj || cnpj.length < 11) continue;

        if (!cnpjMap.has(cnpj)) {
          cnpjMap.set(cnpj, {
            cnpj,
            razaoSocial: c.nomeRazaoSocialFornecedor,
            uf,
            municipio: c.unidadeOrgao?.municipioNome,
            valorHomologado: c.valorGlobal,
            fonte: "pncp_contratos",
          });
        }
      }

      if (cnpjMap.size >= targetCount) break;
      if (pageData.data.length < pageSize) break;
    }

    logger.info(
      `PncpContratos: ${cnpjMap.size} CNPJs PJ unicos de ${totalContratos} contratos em ${pagesScanned} paginas`
    );

    if (cnpjMap.size === 0) return [];

    // Enrich with email data
    const cnpjs = [...cnpjMap.keys()];
    logger.info(`PncpContratos: enriquecendo ${cnpjs.length} CNPJs com email`);
    const emailData = await lookupMultipleCnpjs(cnpjs, false);
    for (const [cnpj, data] of emailData) {
      const result = cnpjMap.get(cnpj);
      if (result && data) {
        result.email = data.email ?? undefined;
        result.telefones = data.telefones ?? undefined;
        result.cnaePrincipal = data.cnaePrincipal ?? undefined;
        if (!result.municipio) result.municipio = data.municipio ?? undefined;
        if (!result.uf) result.uf = data.uf ?? undefined;
      }
    }

    return [...cnpjMap.values()];
  }
}
