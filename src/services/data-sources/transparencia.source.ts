import { lookupMultipleCnpjs } from "../cnpj-lookup.service.js";
import { logger } from "../../utils/logger.js";
import type { DataSource, DataSourceConfig, SourceResult } from "./types.js";

interface TransparenciaConvenio {
  id?: number;
  numero?: string;
  objeto?: string;
  valorConvenio?: number;
  valorLiberado?: number;
  situacao?: string;
  dataInicioVigencia?: string;
  dataFinalVigencia?: string;
  convenente?: {
    cnpjFormatado?: string;
    nome?: string;
    cnpjCpf?: string;
    tipo?: string;
    uf?: { sigla?: string; nome?: string };
    municipio?: { nome?: string };
  };
  orgaoSuperior?: {
    nome?: string;
    sigla?: string;
  };
}

export class TransparenciaSource implements DataSource {
  readonly name = "transparencia";
  readonly label = "TransfereGov - Consorcios";

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
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const dataFinal = config.dataFinal || now.toISOString().slice(0, 10);
    const dataInicial =
      config.dataInicial || ninetyDaysAgo.toISOString().slice(0, 10);

    const limit = config.quantity || 100;

    // Busca convenios - foco em consorcios intermunicipais
    // O endpoint retorna convenentes que podem ser consorcios publicos
    const params = new URLSearchParams({
      dataInicial,
      dataFinal,
      pagina: "1",
      tamanhoPagina: String(limit),
    });
    if (config.uf) {
      params.set("uf", config.uf.toUpperCase());
    }

    const url = `https://api.portaldatransparencia.gov.br/api-de-dados/convenios?${params}`;

    logger.info(
      `TransfereGov: buscando convenios ${dataInicial} a ${dataFinal} uf=${config.uf || "todos"} (foco consorcios)`
    );

    let data: TransparenciaConvenio[];
    try {
      const res = await fetch(url, {
        headers: {
          "chave-api-dados": apiKey,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        throw new Error(
          `Portal Transparencia API error: ${res.status} ${res.statusText}`
        );
      }
      data = (await res.json()) as TransparenciaConvenio[];
    } catch (err: any) {
      logger.error(`TransfereGov API falhou: ${err.message}`);
      throw new Error(`Portal Transparencia indisponivel: ${err.message}`);
    }

    if (!Array.isArray(data)) data = [];

    logger.info(`TransfereGov: ${data.length} convenios retornados`);

    // Filtra apenas convenentes PJ (CNPJ 14 digitos)
    // Prioriza consorcios: tipo contendo "consorcio" ou nome contendo "consorcio"
    const cnpjMap = new Map<string, SourceResult>();
    let consorciosCount = 0;

    for (const c of data) {
      const raw =
        c.convenente?.cnpjCpf?.replace(/\D/g, "") ||
        c.convenente?.cnpjFormatado?.replace(/\D/g, "");
      if (!raw || raw.length !== 14) continue;

      const nome = c.convenente?.nome || "";
      const tipo = c.convenente?.tipo || "";
      const isConsorcio =
        nome.toLowerCase().includes("consorcio") ||
        nome.toLowerCase().includes("consórcio") ||
        tipo.toLowerCase().includes("consorcio") ||
        tipo.toLowerCase().includes("consórcio");

      if (isConsorcio) consorciosCount++;

      if (!cnpjMap.has(raw)) {
        cnpjMap.set(raw, {
          cnpj: raw,
          razaoSocial: nome,
          uf: c.convenente?.uf?.sigla,
          municipio: c.convenente?.municipio?.nome,
          valorHomologado: c.valorConvenio,
          fonte: "transparencia",
        });
      }
    }

    logger.info(
      `TransfereGov: ${cnpjMap.size} CNPJs unicos, ${consorciosCount} consorcios identificados`
    );

    // Enriquece com email via CNPJ lookup
    const cnpjs = [...cnpjMap.keys()];
    if (cnpjs.length > 0) {
      logger.info(
        `TransfereGov: enriquecendo ${cnpjs.length} CNPJs com email`
      );
      const emailData = await lookupMultipleCnpjs(cnpjs, false);
      for (const [cnpj, d] of emailData) {
        const result = cnpjMap.get(cnpj);
        if (result && d) {
          result.email = d.email ?? undefined;
          result.telefones = d.telefones ?? undefined;
          result.cnaePrincipal = d.cnaePrincipal ?? undefined;
          if (!result.municipio) result.municipio = d.municipio ?? undefined;
          if (!result.uf) result.uf = d.uf ?? undefined;
        }
      }
    }

    return [...cnpjMap.values()];
  }
}
