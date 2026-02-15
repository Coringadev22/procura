import { lookupMultipleCnpjs } from "../cnpj-lookup.service.js";
import { logger } from "../../utils/logger.js";
import type { DataSource, DataSourceConfig, SourceResult } from "./types.js";

interface TransparenciaContrato {
  id: number;
  fornecedor?: {
    cnpjFormatado?: string;
    nome?: string;
    cnpjCpf?: string;
  };
  unidadeGestora?: {
    orgaoMaximo?: { sigla?: string };
    ufNome?: string;
    ufSigla?: string;
  };
  valorFinalCompra?: number;
}

export class TransparenciaSource implements DataSource {
  readonly name = "transparencia";
  readonly label = "Portal Transparencia";

  async fetch(config: DataSourceConfig): Promise<SourceResult[]> {
    const apiKey = process.env.PORTAL_TRANSPARENCIA_KEY;
    if (!apiKey) {
      throw new Error(
        "Chave da API do Portal da Transparencia nao configurada. " +
          "Registre em portaldatransparencia.gov.br/api-de-dados/cadastrar-email " +
          "e configure a variavel PORTAL_TRANSPARENCIA_KEY"
      );
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dataFinal =
      config.dataFinal ||
      now.toISOString().slice(0, 10);
    const dataInicial =
      config.dataInicial ||
      thirtyDaysAgo.toISOString().slice(0, 10);

    const limit = config.quantity || 50;
    const url = `https://api.portaldatransparencia.gov.br/api-de-dados/contratos?dataInicial=${dataInicial}&dataFinal=${dataFinal}&pagina=1&tamanhoPagina=${limit}`;

    logger.info(`Transparencia: buscando contratos ${dataInicial} a ${dataFinal}`);

    let data: TransparenciaContrato[];
    try {
      const res = await fetch(url, {
        headers: {
          "chave-api-dados": apiKey,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        throw new Error(
          `Portal Transparencia API error: ${res.status} ${res.statusText}`
        );
      }
      data = (await res.json()) as TransparenciaContrato[];
    } catch (err: any) {
      logger.error(`Transparencia API falhou: ${err.message}`);
      throw new Error(`Portal Transparencia indisponivel: ${err.message}`);
    }

    if (!Array.isArray(data)) data = [];

    const cnpjMap = new Map<string, SourceResult>();
    for (const c of data) {
      const raw =
        c.fornecedor?.cnpjCpf?.replace(/\D/g, "") ||
        c.fornecedor?.cnpjFormatado?.replace(/\D/g, "");
      if (!raw || raw.length !== 14) continue;
      if (!cnpjMap.has(raw)) {
        cnpjMap.set(raw, {
          cnpj: raw,
          razaoSocial: c.fornecedor?.nome,
          uf: c.unidadeGestora?.ufSigla,
          valorHomologado: c.valorFinalCompra,
          fonte: "transparencia",
        });
      }
    }

    // Enrich with email data
    const cnpjs = [...cnpjMap.keys()];
    if (cnpjs.length > 0) {
      logger.info(
        `Transparencia: enriquecendo ${cnpjs.length} CNPJs com email`
      );
      const emailData = await lookupMultipleCnpjs(cnpjs, false);
      for (const [cnpj, d] of emailData) {
        const result = cnpjMap.get(cnpj);
        if (result && d) {
          result.email = d.email ?? undefined;
          result.telefones = d.telefones ?? undefined;
          result.cnaePrincipal = d.cnaePrincipal ?? undefined;
          result.municipio = d.municipio ?? undefined;
          if (!result.uf) result.uf = d.uf ?? undefined;
        }
      }
    }

    return [...cnpjMap.values()];
  }
}
