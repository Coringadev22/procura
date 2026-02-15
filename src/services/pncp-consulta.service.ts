import { fetchWithRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import type {
  PncpConsultaResponse,
  PncpContratacao,
  PncpContrato,
  PncpContratoResponse,
} from "../types/pncp.types.js";

const BASE_URL = "https://pncp.gov.br/api/consulta/v1";

export interface ContratacaoSearchParams {
  dataInicial: string; // YYYYMMDD
  dataFinal: string; // YYYYMMDD
  codigoModalidade?: number;
  uf?: string;
  pagina?: number;
  tamanhoPagina?: number;
}

export async function searchContratacoesByDate(
  params: ContratacaoSearchParams
): Promise<PncpConsultaResponse> {
  const url = new URL(`${BASE_URL}/contratacoes/publicacao`);
  url.searchParams.set("dataInicial", params.dataInicial);
  url.searchParams.set("dataFinal", params.dataFinal);
  if (params.codigoModalidade !== undefined) {
    url.searchParams.set(
      "codigoModalidadeContratacao",
      String(params.codigoModalidade)
    );
  }
  url.searchParams.set("pagina", String(params.pagina ?? 1));
  url.searchParams.set("tamanhoPagina", String(Math.max(params.tamanhoPagina ?? 20, 10)));

  if (params.uf) {
    url.searchParams.set("uf", params.uf.toUpperCase());
  }

  logger.info(`PNCP Consulta contratações: ${url.toString()}`);

  const res = await fetchWithRetry(url.toString());

  if (!res.ok) {
    throw new Error(
      `PNCP Consulta API error: ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<PncpConsultaResponse>;
}

export async function getContratacaoDetail(
  orgaoCnpj: string,
  anoCompra: number,
  sequencialCompra: number
): Promise<PncpContratacao> {
  const url = `${BASE_URL}/orgaos/${orgaoCnpj}/compras/${anoCompra}/${sequencialCompra}`;

  logger.info(`PNCP Consulta detalhe: ${url}`);

  const res = await fetchWithRetry(url);

  if (!res.ok) {
    throw new Error(
      `PNCP Consulta detail error: ${res.status} ${res.statusText}`
    );
  }

  return res.json() as Promise<PncpContratacao>;
}

export interface ContratoSearchParams {
  dataInicial: string; // YYYYMMDD
  dataFinal: string; // YYYYMMDD
  uf?: string;
  pagina?: number;
  tamanhoPagina?: number;
}

async function fetchContratosPage(
  dataInicial: string,
  dataFinal: string,
  pagina: number,
  tamanhoPagina: number
): Promise<PncpContratoResponse> {
  const url = new URL(`${BASE_URL}/contratos`);
  url.searchParams.set("dataInicial", dataInicial);
  url.searchParams.set("dataFinal", dataFinal);
  url.searchParams.set("pagina", String(pagina));
  url.searchParams.set("tamanhoPagina", String(tamanhoPagina));

  const res = await fetchWithRetry(url.toString());
  if (!res.ok) {
    throw new Error(`PNCP Contratos API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<PncpContratoResponse>;
}

export async function searchContratos(
  params: ContratoSearchParams
): Promise<PncpContratoResponse> {
  const uf = params.uf?.toUpperCase();
  const pageSize = Math.max(params.tamanhoPagina ?? 15, 10);

  if (!uf) {
    logger.info(`PNCP Consulta contratos: sem filtro UF, pagina ${params.pagina ?? 1}`);
    return fetchContratosPage(
      params.dataInicial,
      params.dataFinal,
      params.pagina ?? 1,
      pageSize
    );
  }

  // With UF filter: fetch multiple pages (up to 5) from the API to find enough matches
  logger.info(`PNCP Consulta contratos: filtro UF=${uf}, buscando multiplas paginas`);
  const filtered: PncpContrato[] = [];
  const maxApiPages = 5;
  let totalRegistros = 0;

  for (let p = 1; p <= maxApiPages; p++) {
    const page = await fetchContratosPage(
      params.dataInicial,
      params.dataFinal,
      p,
      100
    );
    totalRegistros = page.totalRegistros;

    const matching = page.data.filter((c) => c.unidadeOrgao?.ufSigla === uf);
    filtered.push(...matching);

    if (filtered.length >= pageSize || page.data.length < 100) break;
  }

  return {
    data: filtered.slice(0, pageSize),
    totalRegistros: filtered.length,
    totalPaginas: Math.ceil(filtered.length / pageSize),
    numeroPagina: params.pagina ?? 1,
  };
}
