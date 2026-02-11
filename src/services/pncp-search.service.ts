import { fetchWithRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
import type { PncpSearchResponse } from "../types/pncp.types.js";

const BASE_URL = "https://pncp.gov.br/api/search";

export interface SearchParams {
  q: string;
  uf?: string;
  pagina?: number;
  tamanhoPagina?: number;
  dataInicial?: string;
  dataFinal?: string;
}

export async function searchLicitacoes(
  params: SearchParams
): Promise<PncpSearchResponse> {
  const uf = params.uf?.toUpperCase();
  const hasLocalFilters = uf || params.dataInicial || params.dataFinal;
  // PNCP Search API ignores 'uf' and date params, so we fetch more and filter locally
  const fetchSize = hasLocalFilters ? Math.max((params.tamanhoPagina ?? 20) * 3, 60) : (params.tamanhoPagina ?? 20);

  const url = new URL(BASE_URL);
  url.searchParams.set("q", params.q);
  url.searchParams.set("tipos_documento", "edital");
  url.searchParams.set("status", "divulgada");
  url.searchParams.set("pagina", String(params.pagina ?? 1));
  url.searchParams.set("tam_pagina", String(fetchSize));
  url.searchParams.set("ordenacao", "-data");

  logger.info(`PNCP Search: ${url.toString()}`);

  const res = await fetchWithRetry(url.toString());

  if (!res.ok) {
    throw new Error(`PNCP Search API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as PncpSearchResponse;

  let items = data.items;

  if (uf) {
    items = items.filter((item) => item.uf === uf);
  }

  if (params.dataInicial || params.dataFinal) {
    items = items.filter((item) => {
      const pubDate = item.data_publicacao_pncp?.substring(0, 10).replace(/-/g, "");
      if (params.dataInicial && pubDate < params.dataInicial) return false;
      if (params.dataFinal && pubDate > params.dataFinal) return false;
      return true;
    });
  }

  if (uf || params.dataInicial || params.dataFinal) {
    return {
      items: items.slice(0, params.tamanhoPagina ?? 20),
      total: items.length,
    };
  }

  return data;
}
