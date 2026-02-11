// API response types for our endpoints

export interface ApiResponse<T> {
  data: T;
  total?: number;
  page?: number;
  pageSize?: number;
}

export interface LicitacaoSearchResult {
  numeroControlePNCP: string;
  orgaoCnpj: string;
  orgaoNome: string;
  anoCompra: number;
  sequencialCompra: number;
  objetoCompra: string;
  modalidade: string;
  uf: string;
  municipio: string;
  valorEstimado: number | null;
  dataPublicacao: string;
  situacao: string;
  temResultado: boolean;
}

export interface FornecedorComEmail {
  cnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  email: string | null;
  emailSource: string;
  telefones: string | null;
  municipio: string | null;
  uf: string | null;
  porte: string | null;
  valorHomologado?: number | null;
  itemDescricao?: string | null;
}

export interface ContratoSearchResult {
  numeroControlePNCP: string;
  orgaoCnpj: string;
  orgaoNome: string;
  fornecedorCnpj: string;
  fornecedorNome: string;
  objetoContrato: string;
  valorGlobal: number;
  dataAssinatura: string;
  uf: string;
  municipio: string;
}
