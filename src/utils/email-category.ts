export type EmailCategory = "empresa" | "provavel_contabilidade" | "contabilidade";

const CONTABILIDADE_DOMAIN_PATTERNS = [
  "contab",
  "contabil",
  "assessor",
  "escritorio",
  "escrit",
  "contador",
  "contad",
  "fiscal",
  "tribut",
  "acessoria",
  "consultcontab",
  "auditoria",
  "pericias",
  "pericia",
  "imposto",
  "irpf",
  "societario",
  "folha",
  "deptopessoal",
  "depto.pessoal",
  "dp.",
];

const CONTABILIDADE_PREFIX_PATTERNS = [
  "contab",
  "fiscal",
  "assessor",
  "contador",
  "contad",
  "tribut",
  "auditoria",
];

const CONTABILIDADE_CNAE_PATTERNS = [
  "contab",
  "contabil",
  "auditoria",
  "assessoria",
  "pericia",
  "pericias",
  "fiscal",
  "69.20",
  "6920-6",
  "atividades de contabilidade",
];

const CONTABILIDADE_NOME_PATTERNS = [
  "contab",
  "contabil",
  "assessor",
  "auditoria",
  "escritorio contab",
  "escritorio de contab",
  "pericia",
  "pericias",
];

const PROVAVEL_CONTAB_CNAE_PATTERNS = [
  "consultoria",
  "advocacia",
  "69.1",
  "69.2",
  "69.3",
];

function hasContabilidadeDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return CONTABILIDADE_DOMAIN_PATTERNS.some((p) => domain.includes(p));
}

function hasContabilidadePrefix(email: string): boolean {
  const prefix = email.split("@")[0]?.toLowerCase() ?? "";
  return CONTABILIDADE_PREFIX_PATTERNS.some((p) => prefix.includes(p));
}

/**
 * Classifica email em 3 camadas:
 * 1. Detecção por domínio (mais confiável)
 * 2. Comparação entre fontes (se disponível)
 * 3. Sugestão pela fonte (fallback)
 */
export function detectEmailCategory(
  email: string | null,
  source: string,
  alternativeEmail?: string | null
): EmailCategory {
  if (!email) return "empresa";

  // Camada 1: Detecção por domínio — mais confiável
  if (hasContabilidadeDomain(email)) {
    return "contabilidade";
  }

  // Camada 1b: Detecção por prefixo
  if (hasContabilidadePrefix(email)) {
    return "provavel_contabilidade";
  }

  // Camada 2: Comparação entre fontes
  if (source === "receitaws" && alternativeEmail && alternativeEmail.toLowerCase() !== email.toLowerCase()) {
    return "contabilidade";
  }

  // Camada 3: Sugestão pela fonte
  if (source === "receitaws") {
    return "provavel_contabilidade";
  }

  return "empresa";
}

/**
 * Classifica um lead analisando email + CNAE + razao social
 * Usa 3 fontes de informacao para determinar se e contabilidade
 */
export function classifyLead(
  email: string | null,
  cnaePrincipal: string | null,
  razaoSocial: string | null
): EmailCategory {
  const cnae = (cnaePrincipal || "").toLowerCase();
  const nome = (razaoSocial || "").toLowerCase();

  // 1. CNAE indica contabilidade diretamente
  if (CONTABILIDADE_CNAE_PATTERNS.some((p) => cnae.includes(p))) {
    return "contabilidade";
  }

  // 2. Razao social indica contabilidade
  if (CONTABILIDADE_NOME_PATTERNS.some((p) => nome.includes(p))) {
    return "contabilidade";
  }

  // 3. Email dominio indica contabilidade
  if (email && hasContabilidadeDomain(email)) {
    return "contabilidade";
  }

  // 4. Email prefixo indica provavel contabilidade
  if (email && hasContabilidadePrefix(email)) {
    return "provavel_contabilidade";
  }

  // 5. CNAE de area correlata (consultoria, advocacia) = provavel
  if (PROVAVEL_CONTAB_CNAE_PATTERNS.some((p) => cnae.includes(p))) {
    return "provavel_contabilidade";
  }

  return "empresa";
}
