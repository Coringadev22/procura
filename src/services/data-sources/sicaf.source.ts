import { lookupMultipleCnpjs } from "../cnpj-lookup.service.js";
import { logger } from "../../utils/logger.js";
import type { DataSource, DataSourceConfig, SourceResult } from "./types.js";

interface SicafFornecedor {
  id_fornecedor: string;
  nome: string;
  ativo: boolean;
  cnpj?: string;
  cpf?: string;
}

interface SicafResponse {
  _embedded?: { fornecedores: SicafFornecedor[] };
  _links?: Record<string, unknown>;
}

export class SicafSource implements DataSource {
  readonly name = "sicaf";
  readonly label = "SICAF (Compras.gov)";

  async fetch(config: DataSourceConfig): Promise<SourceResult[]> {
    if (!config.uf) throw new Error("SICAF requer filtro de UF");

    const limit = config.quantity || 50;
    const url = `http://compras.dados.gov.br/fornecedores/v1/fornecedores.json?uf=${config.uf.toUpperCase()}&offset=0&limit=${limit}`;

    logger.info(`SICAF: buscando fornecedores UF=${config.uf} limit=${limit}`);

    let data: SicafResponse;
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        throw new Error(`SICAF API error: ${res.status} ${res.statusText}`);
      }
      data = (await res.json()) as SicafResponse;
    } catch (err: any) {
      logger.error(`SICAF API falhou: ${err.message}`);
      throw new Error(`SICAF API indisponivel: ${err.message}`);
    }

    const fornecedores = data._embedded?.fornecedores || [];
    logger.info(`SICAF: ${fornecedores.length} fornecedores encontrados`);

    // Filter PJ only (has cnpj, not cpf)
    const pjFornecedores = fornecedores.filter(
      (f) => f.cnpj && f.cnpj.length >= 11
    );

    const results: SourceResult[] = pjFornecedores.map((f) => ({
      cnpj: f.cnpj!.replace(/\D/g, ""),
      razaoSocial: f.nome,
      uf: config.uf?.toUpperCase(),
      fonte: "sicaf",
    }));

    // Enrich with email data
    const cnpjs = results.map((r) => r.cnpj);
    if (cnpjs.length > 0) {
      logger.info(`SICAF: enriquecendo ${cnpjs.length} CNPJs com email`);
      const emailData = await lookupMultipleCnpjs(cnpjs, false);
      for (const r of results) {
        const d = emailData.get(r.cnpj);
        if (d) {
          r.email = d.email ?? undefined;
          r.telefones = d.telefones ?? undefined;
          r.cnaePrincipal = d.cnaePrincipal ?? undefined;
          r.municipio = d.municipio ?? undefined;
          if (!r.uf) r.uf = d.uf ?? undefined;
        }
      }
    }

    return results;
  }
}
