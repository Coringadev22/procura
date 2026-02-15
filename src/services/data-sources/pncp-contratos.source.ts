import { searchContratos } from "../pncp-consulta.service.js";
import { lookupMultipleCnpjs } from "../cnpj-lookup.service.js";
import { logger } from "../../utils/logger.js";
import type { DataSource, DataSourceConfig, SourceResult } from "./types.js";

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

    logger.info(
      `PncpContratos: buscando contratos ${dataInicial}-${dataFinal} uf=${config.uf || "todos"}`
    );

    const response = await searchContratos({
      dataInicial,
      dataFinal,
      uf: config.uf,
      tamanhoPagina: config.quantity || 50,
    });

    // Extract unique PJ CNPJs
    const pjContracts = response.data.filter((c) => c.tipoPessoa === "PJ");
    const cnpjMap = new Map<string, SourceResult>();

    for (const c of pjContracts) {
      const cnpj = c.niFornecedor.replace(/\D/g, "");
      if (!cnpj || cnpj.length < 11) continue;
      if (!cnpjMap.has(cnpj)) {
        cnpjMap.set(cnpj, {
          cnpj,
          razaoSocial: c.nomeRazaoSocialFornecedor,
          uf: c.unidadeOrgao?.ufSigla,
          municipio: c.unidadeOrgao?.municipioNome,
          valorHomologado: c.valorGlobal,
          fonte: "pncp_contratos",
        });
      }
    }

    // Enrich with email data
    const cnpjs = [...cnpjMap.keys()];
    if (cnpjs.length > 0) {
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
    }

    return [...cnpjMap.values()];
  }
}
