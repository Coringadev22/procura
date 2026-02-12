import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

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
  emailCategory: text("email_category"),
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

// Gmail OAuth accounts
export const gmailAccounts = sqliteTable("gmail_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiry: text("token_expiry").notNull(),
  displayName: text("display_name"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  dailySentCount: integer("daily_sent_count").notNull().default(0),
  dailySentDate: text("daily_sent_date"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// Email templates
export const emailTemplates = sqliteTable("email_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  targetCategory: text("target_category"),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// Email send log
export const emailSendLog = sqliteTable("email_send_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gmailAccountId: integer("gmail_account_id")
    .notNull()
    .references(() => gmailAccounts.id),
  templateId: integer("template_id").references(() => emailTemplates.id),
  recipientEmail: text("recipient_email").notNull(),
  recipientCnpj: text("recipient_cnpj"),
  recipientName: text("recipient_name"),
  subject: text("subject").notNull(),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  sentAt: text("sent_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// Automation jobs
export const automationJobs = sqliteTable("automation_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),

  // Search parameters
  searchKeyword: text("search_keyword").notNull().default(""),
  searchUf: text("search_uf"),
  searchQuantity: integer("search_quantity").notNull().default(20),
  searchCnae: text("search_cnae"),

  // Email sending parameters
  templateId: integer("template_id").references(() => emailTemplates.id),
  gmailAccountId: integer("gmail_account_id").references(() => gmailAccounts.id),
  targetCategory: text("target_category"),

  // Source configuration
  sourceType: text("source_type").notNull().default("search"),

  // Schedule
  intervalDays: integer("interval_days").notNull().default(1),
  maxEmailsPerRun: integer("max_emails_per_run").notNull().default(50),
  lastRunAt: text("last_run_at"),
  nextRunAt: text("next_run_at"),
  lastRunStatus: text("last_run_status"),
  lastRunStats: text("last_run_stats"),

  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// Automation run log
export const automationRunLog = sqliteTable("automation_run_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id")
    .notNull()
    .references(() => automationJobs.id),
  startedAt: text("started_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  completedAt: text("completed_at"),
  status: text("status").notNull().default("running"),
  emailsFound: integer("emails_found").notNull().default(0),
  emailsSent: integer("emails_sent").notNull().default(0),
  emailsFailed: integer("emails_failed").notNull().default(0),
  emailsSkipped: integer("emails_skipped").notNull().default(0),
  errorMessage: text("error_message"),
  details: text("details"),
});
