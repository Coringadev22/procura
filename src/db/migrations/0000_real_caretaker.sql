CREATE TABLE `contratos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`numero_controle_pncp` text NOT NULL,
	`orgao_cnpj` text NOT NULL,
	`orgao_nome` text,
	`fornecedor_cnpj` text,
	`fornecedor_nome` text,
	`tipo_pessoa` text,
	`objeto_contrato` text,
	`valor_global` real,
	`data_assinatura` text,
	`data_vigencia_inicio` text,
	`data_vigencia_fim` text,
	`uf` text,
	`municipio` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contratos_numero_controle_pncp_unique` ON `contratos` (`numero_controle_pncp`);--> statement-breakpoint
CREATE TABLE `fornecedores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cnpj` text NOT NULL,
	`razao_social` text,
	`nome_fantasia` text,
	`porte` text,
	`email` text,
	`telefones` text,
	`logradouro` text,
	`municipio` text,
	`uf` text,
	`cep` text,
	`cnae_principal` text,
	`situacao_cadastral` text,
	`email_source` text,
	`last_lookup_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fornecedores_cnpj_unique` ON `fornecedores` (`cnpj`);--> statement-breakpoint
CREATE TABLE `licitacao_fornecedores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`licitacao_id` integer NOT NULL,
	`fornecedor_id` integer NOT NULL,
	`valor_homologado` real,
	`item_descricao` text,
	`numero_item` integer,
	`data_resultado` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`licitacao_id`) REFERENCES `licitacoes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fornecedor_id`) REFERENCES `fornecedores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `licitacoes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`numero_controle_pncp` text NOT NULL,
	`orgao_cnpj` text NOT NULL,
	`orgao_nome` text,
	`ano_compra` integer NOT NULL,
	`sequencial_compra` integer NOT NULL,
	`objeto_compra` text,
	`modalidade_nome` text,
	`uf` text,
	`municipio` text,
	`valor_total_estimado` real,
	`valor_total_homologado` real,
	`data_publicacao` text,
	`situacao` text,
	`tem_resultado` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `licitacoes_numero_controle_pncp_unique` ON `licitacoes` (`numero_controle_pncp`);