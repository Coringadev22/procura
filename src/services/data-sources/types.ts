export interface SourceResult {
  cnpj: string;
  razaoSocial?: string;
  email?: string;
  telefones?: string;
  municipio?: string;
  uf?: string;
  cnaePrincipal?: string;
  valorHomologado?: number;
  fonte: string;
  // PF fields
  tipoPessoa?: "PJ" | "PF";
  cpf?: string;
  nomeCompleto?: string;
}

export interface DataSourceConfig {
  uf?: string;
  keyword?: string;
  quantity?: number;
  cnae?: string;
  dataInicial?: string;
  dataFinal?: string;
}

export interface DataSource {
  readonly name: string;
  readonly label: string;
  fetch(config: DataSourceConfig): Promise<SourceResult[]>;
}
