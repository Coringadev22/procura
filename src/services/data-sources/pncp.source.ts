import { runEmailSearch } from "../email-search.service.js";
import type { DataSource, DataSourceConfig, SourceResult } from "./types.js";

export class PncpSource implements DataSource {
  readonly name = "pncp";
  readonly label = "PNCP Licitacoes";

  async fetch(config: DataSourceConfig): Promise<SourceResult[]> {
    const result = await runEmailSearch({
      q: config.keyword || "",
      uf: config.uf,
      minResultados: config.quantity || 20,
      dataInicial: config.dataInicial,
      dataFinal: config.dataFinal,
    });

    return result.data.map((f) => ({
      cnpj: f.cnpj,
      razaoSocial: f.razaoSocial ?? undefined,
      email: f.email ?? undefined,
      telefones: f.telefones ?? undefined,
      municipio: f.municipio ?? undefined,
      uf: f.uf ?? undefined,
      cnaePrincipal: f.cnaePrincipal ?? undefined,
      valorHomologado: f.valorHomologado ?? undefined,
      fonte: "pncp",
    }));
  }
}
