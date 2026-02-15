import { fetchWithRetry } from "../utils/retry.js";
import { enrichLicitacao } from "./email-enrichment.service.js";
import { searchContratacoesByDate } from "./pncp-consulta.service.js";
import { lookupMultipleCnpjs } from "./cnpj-lookup.service.js";
import { logger } from "../utils/logger.js";
import type { FornecedorComEmail } from "../types/api.types.js";
import type { PncpSearchItem, PncpSearchResponse } from "../types/pncp.types.js";

const PNCP_SEARCH_URL = "https://pncp.gov.br/api/search";

async function fetchSearchPage(
  q: string,
  pagina: number,
  tamPagina: number
): Promise<PncpSearchResponse> {
  const url = new URL(PNCP_SEARCH_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("tipos_documento", "edital");
  url.searchParams.set("status", "divulgada");
  url.searchParams.set("pagina", String(pagina));
  url.searchParams.set("tam_pagina", String(tamPagina));
  url.searchParams.set("ordenacao", "-data");

  const res = await fetchWithRetry(url.toString());
  if (!res.ok) throw new Error(`PNCP Search error: ${res.status}`);
  return res.json() as Promise<PncpSearchResponse>;
}

export interface EmailSearchParams {
  q: string;
  uf?: string;
  minResultados?: number;
  dataInicial?: string;
  dataFinal?: string;
}

export interface EmailSearchResult {
  data: Array<FornecedorComEmail & { licitacaoOrgao: string; licitacaoObjeto: string; licitacoes: string[] }>;
  total: number;
  comEmail: number;
  semEmail: number;
  licitacoesAnalisadas: number;
  licitacoesComResultado: number;
  emails: (string | null)[];
  erros?: string[];
  message?: string;
}

export async function runEmailSearch(params: EmailSearchParams): Promise<EmailSearchResult> {
  const { q, uf, dataInicial, dataFinal } = params;
  const minResultados = params.minResultados
    ? Math.min(params.minResultados, 200)
    : 20;

  // === PHASE 1: Find licitações with resultado ===
  const comResultado: PncpSearchItem[] = [];
  let totalAnalisadas = 0;

  if (uf) {
    // Use Consulta API with native UF filter (much more efficient per state)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const di = dataInicial || thirtyDaysAgo.toISOString().slice(0, 10).replace(/-/g, "");
    const df = dataFinal || now.toISOString().slice(0, 10).replace(/-/g, "");

    logger.info(
      `Busca-emails: UF=${uf} via Consulta API ${di}-${df}, buscando ate ${minResultados} licitacoes com resultado`
    );

    const maxPages = 10;
    const pageSize = 50;

    for (let page = 1; page <= maxPages; page++) {
      try {
        const result = await searchContratacoesByDate({
          dataInicial: di,
          dataFinal: df,
          uf,
          pagina: page,
          tamanhoPagina: pageSize,
        });

        if (!result.data || result.data.length === 0) break;
        totalAnalisadas += result.data.length;

        for (const c of result.data) {
          if (c.existeResultado) {
            comResultado.push({
              orgao_cnpj: c.orgaoEntidade.cnpj,
              orgao_nome: c.orgaoEntidade.razaoSocial,
              uf: c.unidadeOrgao.ufSigla,
              municipio_nome: c.unidadeOrgao.municipioNome,
              tem_resultado: true,
              ano: String(c.anoCompra),
              numero_sequencial: String(c.sequencialCompra),
              description: c.objetoCompra,
              data_publicacao_pncp: c.dataPublicacaoPncp,
              numero_controle_pncp: c.numeroControlePNCP,
            } as PncpSearchItem);
          }
        }

        logger.info(
          `  Pagina ${page}: ${result.data.length} contratacoes, ${comResultado.length} com resultado ate agora`
        );

        if (comResultado.length >= minResultados) break;
        if (result.data.length < pageSize) break;
      } catch (err: any) {
        logger.error(`Consulta API page ${page} error: ${err.message}`);
        break;
      }
    }
  } else {
    // No UF: use Search API (broader, but no native UF filter)
    const maxPages = 30;
    const pageSize = 50;

    logger.info(
      `Busca-emails: q="${q}" uf=todas buscando ate ${minResultados} licitacoes com resultado`
    );

    for (let page = 1; page <= maxPages; page++) {
      const result = await fetchSearchPage(q, page, pageSize);
      let items = result.items;

      if (!items || items.length === 0) break;

      if (dataInicial || dataFinal) {
        items = items.filter((item) => {
          const pubDate = item.data_publicacao_pncp?.substring(0, 10).replace(/-/g, "");
          if (dataInicial && pubDate < dataInicial) return false;
          if (dataFinal && pubDate > dataFinal) return false;
          return true;
        });
      }

      totalAnalisadas += result.items.length;

      for (const item of items) {
        if (item.tem_resultado) {
          comResultado.push(item);
        }
      }

      logger.info(
        `  Pagina ${page}: ${result.items.length} itens, ${comResultado.length} com resultado ate agora`
      );

      if (comResultado.length >= minResultados) break;
      if (result.items.length < pageSize) break;
    }
  }

  if (comResultado.length === 0) {
    return {
      data: [],
      total: 0,
      comEmail: 0,
      semEmail: 0,
      licitacoesAnalisadas: totalAnalisadas,
      licitacoesComResultado: 0,
      emails: [],
      message: "Nenhuma licitacao com resultado encontrada para " + (uf || "esta busca") + ". Tente uma busca mais ampla.",
    };
  }

  logger.info(
    `Busca-emails: encontrei ${comResultado.length} licitacoes com resultado de ${totalAnalisadas} analisadas`
  );

  // === PHASE 2: Get supplier data fast (BrasilAPI, no email wait) ===
  logger.info("Fase 2: Buscando dados dos fornecedores via BrasilAPI (rapido)...");
  const todosEmails: Array<
    FornecedorComEmail & { licitacaoOrgao: string; licitacaoObjeto: string }
  > = [];
  const erros: string[] = [];
  const batchSize = 5;

  for (let i = 0; i < comResultado.length; i += batchSize) {
    const batch = comResultado.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (lic) => {
        const fornecedores = await enrichLicitacao(
          lic.orgao_cnpj,
          Number(lic.ano),
          Number(lic.numero_sequencial),
          true
        );
        return fornecedores.map((f) => ({
          ...f,
          licitacaoOrgao: lic.orgao_nome,
          licitacaoObjeto: lic.description?.substring(0, 150) ?? "",
        }));
      })
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        todosEmails.push(...result.value);
      } else {
        const msg = `Erro na licitação ${batch[j].numero_controle_pncp}: ${result.reason}`;
        logger.error(msg);
        erros.push(msg);
      }
    }
  }

  // === PHASE 3: Batch email lookup for all unique CNPJs without email ===
  const cnpjsSemEmail = [...new Set(
    todosEmails.filter((f) => !f.email).map((f) => f.cnpj)
  )];

  if (cnpjsSemEmail.length > 0) {
    logger.info(
      `Fase 3: Buscando emails para ${cnpjsSemEmail.length} CNPJs via ReceitaWS + CNPJ.ws...`
    );
    const emailResults = await lookupMultipleCnpjs(cnpjsSemEmail, false);

    for (const f of todosEmails) {
      if (!f.email) {
        const lookup = emailResults.get(f.cnpj);
        if (lookup?.email) {
          f.email = lookup.email;
          f.emailSource = lookup.emailSource;
        }
      }
    }
  }

  // === PHASE 4: Deduplicate and return ===
  const porCnpj = new Map<
    string,
    (typeof todosEmails)[number] & { licitacoes: string[] }
  >();
  for (const f of todosEmails) {
    const existing = porCnpj.get(f.cnpj);
    if (existing) {
      existing.licitacoes.push(f.licitacaoObjeto);
      existing.valorHomologado =
        (existing.valorHomologado ?? 0) + (f.valorHomologado ?? 0);
    } else {
      porCnpj.set(f.cnpj, { ...f, licitacoes: [f.licitacaoObjeto] });
    }
  }

  const resultado = [...porCnpj.values()];
  const comEmail = resultado.filter((f) => f.email);
  const semEmail = resultado.filter((f) => !f.email);

  return {
    data: resultado,
    total: resultado.length,
    comEmail: comEmail.length,
    semEmail: semEmail.length,
    licitacoesAnalisadas: totalAnalisadas,
    licitacoesComResultado: comResultado.length,
    emails: comEmail.map((f) => f.email),
    erros: erros.length > 0 ? erros : undefined,
  };
}
