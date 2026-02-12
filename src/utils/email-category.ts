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
];

function hasContabilidadeDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return CONTABILIDADE_DOMAIN_PATTERNS.some((p) => domain.includes(p));
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

  // Camada 2: Comparação entre fontes
  // Se temos email de outra fonte E são diferentes, o de ReceitaWS é provavelmente contabilidade
  if (source === "receitaws" && alternativeEmail && alternativeEmail.toLowerCase() !== email.toLowerCase()) {
    return "contabilidade";
  }

  // Camada 3: Sugestão pela fonte
  if (source === "receitaws") {
    return "provavel_contabilidade";
  }

  return "empresa";
}
