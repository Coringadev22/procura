// PNCP Search API response
export interface PncpSearchResponse {
  items: PncpSearchItem[];
  total: number;
}

export interface PncpSearchItem {
  id: string;
  title: string;
  description: string;
  item_url: string;
  orgao_cnpj: string;
  orgao_nome: string;
  uf: string;
  municipio_nome: string;
  modalidade_licitacao_nome: string;
  situacao_nome: string;
  tem_resultado: boolean;
  data_publicacao_pncp: string;
  numero_controle_pncp: string;
  ano: string;
  numero_sequencial: string;
}

// PNCP Consulta API response
export interface PncpConsultaResponse {
  data: PncpContratacao[];
  totalRegistros?: number;
  totalPaginas?: number;
  numeroPagina?: number;
}

export interface PncpContratacao {
  orgaoEntidade: { cnpj: string; razaoSocial: string };
  unidadeOrgao: {
    ufNome: string;
    ufSigla: string;
    municipioNome: string;
    codigoIbge: string;
  };
  anoCompra: number;
  sequencialCompra: number;
  numeroCompra: string;
  processo: string;
  objetoCompra: string;
  valorTotalEstimado: number | null;
  valorTotalHomologado: number | null;
  modalidadeNome: string;
  situacaoCompraNome: string;
  dataPublicacaoPncp: string;
  dataAberturaProposta: string;
  dataEncerramentoProposta: string;
  srp: boolean;
  numeroControlePNCP: string;
  existeResultado?: boolean;
}

// PNCP Integration API - Items
export interface PncpItem {
  numeroItem: number;
  descricao: string;
  valorUnitarioEstimado: number | null;
  quantidade: number;
  situacaoCompraItemNome: string;
  temResultado: boolean;
}

// PNCP Integration API - Results
export interface PncpResultado {
  niFornecedor: string;
  tipoPessoa: string;
  nomeRazaoSocialFornecedor: string;
  valorTotalHomologado: number | null;
  valorUnitarioHomologado: number | null;
  quantidadeHomologada: number | null;
  porteFornecedorNome: string;
  situacaoCompraItemResultadoNome: string;
  dataResultado: string;
  ordemClassificacaoSrp: number | null;
}

// PNCP Contracts
export interface PncpContratoResponse {
  data: PncpContrato[];
  totalRegistros: number;
  totalPaginas: number;
  numeroPagina: number;
}

export interface PncpContrato {
  niFornecedor: string;
  tipoPessoa: string;
  nomeRazaoSocialFornecedor: string;
  objetoContrato: string;
  valorGlobal: number;
  orgaoEntidade: { cnpj: string; razaoSocial: string };
  unidadeOrgao: {
    ufNome: string;
    ufSigla: string;
    municipioNome: string;
  };
  dataAssinatura: string;
  dataVigenciaInicio: string;
  dataVigenciaFim: string;
  numeroControlePNCP: string;
}
