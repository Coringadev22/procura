import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const licitacoes = sqliteTable("licitacoes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  numeroControlePNCP: text("numero_controle_pncp").notNull().unique(),
  orgaoCnpj: text("orgao_cnpj").notNull(),
  orgaoNome: text("orgao_nome"),
  anoCompra: integer("ano_compra").notNull(),
  sequencialCompra: integer("sequencial_compra").notNull(),
  objetoCompra: text("objeto_compra"),
  modalidadeNome: text("modalidade_nome"),
  uf: text("uf"),
  municipio: text("municipio"),
  valorTotalEstimado: real("valor_total_estimado"),
  valorTotalHomologado: real("valor_total_homologado"),
  dataPublicacao: text("data_publicacao"),
  situacao: text("situacao"),
  temResultado: integer("tem_resultado", { mode: "boolean" }),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const fornecedores = sqliteTable("fornecedores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cnpj: text("cnpj").notNull().unique(),
  razaoSocial: text("razao_social"),
  nomeFantasia: text("nome_fantasia"),
  porte: text("porte"),
  email: text("email"),
  telefones: text("telefones"),
  logradouro: text("logradouro"),
  municipio: text("municipio"),
  uf: text("uf"),
  cep: text("cep"),
  cnaePrincipal: text("cnae_principal"),
  situacaoCadastral: text("situacao_cadastral"),
  emailSource: text("email_source"),
  lastLookupAt: text("last_lookup_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const licitacaoFornecedores = sqliteTable("licitacao_fornecedores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  licitacaoId: integer("licitacao_id")
    .notNull()
    .references(() => licitacoes.id),
  fornecedorId: integer("fornecedor_id")
    .notNull()
    .references(() => fornecedores.id),
  valorHomologado: real("valor_homologado"),
  itemDescricao: text("item_descricao"),
  numeroItem: integer("numero_item"),
  dataResultado: text("data_resultado"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const contratos = sqliteTable("contratos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  numeroControlePNCP: text("numero_controle_pncp").notNull().unique(),
  orgaoCnpj: text("orgao_cnpj").notNull(),
  orgaoNome: text("orgao_nome"),
  fornecedorCnpj: text("fornecedor_cnpj"),
  fornecedorNome: text("fornecedor_nome"),
  tipoPessoa: text("tipo_pessoa"),
  objetoContrato: text("objeto_contrato"),
  valorGlobal: real("valor_global"),
  dataAssinatura: text("data_assinatura"),
  dataVigenciaInicio: text("data_vigencia_inicio"),
  dataVigenciaFim: text("data_vigencia_fim"),
  uf: text("uf"),
  municipio: text("municipio"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
