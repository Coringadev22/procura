import { lookupMultipleCnpjs } from "../cnpj-lookup.service.js";
import { logger } from "../../utils/logger.js";
import type { DataSource, DataSourceConfig, SourceResult } from "./types.js";

interface TceRjContrato {
  cd_Credor?: string;
  nm_Credor?: string;
  nu_CPFCNPJ?: string;
  vl_Contrato?: number;
  ds_ObjContrato?: string;
}

export class TceRjSource implements DataSource {
  readonly name = "tce_rj";
  readonly label = "TCE-RJ";

  async fetch(config: DataSourceConfig): Promise<SourceResult[]> {
    const limit = config.quantity || 50;
    const url = `https://dados.tcerj.tc.br/api/v1/contratos?limit=${limit}`;

    logger.info(`TCE-RJ: buscando contratos limit=${limit}`);

    let data: TceRjContrato[];
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        throw new Error(`TCE-RJ API error: ${res.status} ${res.statusText}`);
      }
      const json = await res.json();
      data = Array.isArray(json) ? json : json.data || json.results || [];
    } catch (err: any) {
      logger.error(`TCE-RJ API falhou: ${err.message}`);
      throw new Error(`TCE-RJ API indisponivel: ${err.message}`);
    }

    // Filter PJ (CNPJ has 14 digits)
    const cnpjMap = new Map<string, SourceResult>();
    for (const c of data) {
      const raw = c.nu_CPFCNPJ?.replace(/\D/g, "");
      if (!raw || raw.length !== 14) continue;
      if (!cnpjMap.has(raw)) {
        cnpjMap.set(raw, {
          cnpj: raw,
          razaoSocial: c.nm_Credor,
          uf: "RJ",
          valorHomologado: c.vl_Contrato,
          fonte: "tce_rj",
        });
      }
    }

    // Enrich with email data
    const cnpjs = [...cnpjMap.keys()];
    if (cnpjs.length > 0) {
      logger.info(`TCE-RJ: enriquecendo ${cnpjs.length} CNPJs com email`);
      const emailData = await lookupMultipleCnpjs(cnpjs, false);
      for (const [cnpj, d] of emailData) {
        const result = cnpjMap.get(cnpj);
        if (result && d) {
          result.email = d.email ?? undefined;
          result.telefones = d.telefones ?? undefined;
          result.cnaePrincipal = d.cnaePrincipal ?? undefined;
          result.municipio = d.municipio ?? undefined;
        }
      }
    }

    return [...cnpjMap.values()];
  }
}
