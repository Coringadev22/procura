import { eq, and } from "drizzle-orm";
import { db } from "../config/database.js";
import { licitacoes, licitacaoFornecedores, fornecedores } from "../db/schema.js";
import { getAllResultados } from "./pncp-integration.service.js";
import { lookupCnpj, lookupMultipleCnpjs } from "./cnpj-lookup.service.js";
import { cleanCnpj } from "../utils/cnpj.js";
import { logger } from "../utils/logger.js";
import type { FornecedorComEmail } from "../types/api.types.js";

export async function enrichLicitacao(
  orgaoCnpj: string,
  anoCompra: number,
  sequencialCompra: number,
  skipSlowFallback = false
): Promise<FornecedorComEmail[]> {
  // 1. Get all results (supplier CNPJs) from PNCP
  const resultados = await getAllResultados(
    orgaoCnpj,
    anoCompra,
    sequencialCompra
  );

  if (resultados.length === 0) {
    return [];
  }

  // 2. Filter PJ only (companies with CNPJ)
  const pjResultados = resultados.filter((r) => r.tipoPessoa === "PJ");

  logger.info(
    `${pjResultados.length} fornecedores PJ de ${resultados.length} resultados totais`
  );

  // 3. Get unique CNPJs
  const uniqueCnpjs = [
    ...new Set(pjResultados.map((r) => cleanCnpj(r.niFornecedor))),
  ];

  // 4. Lookup all CNPJs in parallel (cache-first via cnpj-lookup service)
  const cnpjDataMap = await lookupMultipleCnpjs(uniqueCnpjs, skipSlowFallback);

  // 5. Ensure licitacao record exists for linking
  const controlePncp = `${orgaoCnpj}-1-${String(sequencialCompra).padStart(6, "0")}/${anoCompra}`;
  let licitacao = db
    .select()
    .from(licitacoes)
    .where(eq(licitacoes.numeroControlePNCP, controlePncp))
    .get();

  if (!licitacao) {
    db.insert(licitacoes)
      .values({
        numeroControlePNCP: controlePncp,
        orgaoCnpj,
        anoCompra,
        sequencialCompra,
        temResultado: true,
      })
      .run();

    licitacao = db
      .select()
      .from(licitacoes)
      .where(eq(licitacoes.numeroControlePNCP, controlePncp))
      .get();
  }

  // 6. Link fornecedores to licitacao
  if (licitacao) {
    for (const r of pjResultados) {
      const cnpj = cleanCnpj(r.niFornecedor);
      const fornecedor = db
        .select()
        .from(fornecedores)
        .where(eq(fornecedores.cnpj, cnpj))
        .get();

      if (fornecedor) {
        const existing = db
          .select()
          .from(licitacaoFornecedores)
          .where(
            and(
              eq(licitacaoFornecedores.licitacaoId, licitacao.id),
              eq(licitacaoFornecedores.fornecedorId, fornecedor.id),
              eq(licitacaoFornecedores.numeroItem, r.numeroItem)
            )
          )
          .get();

        if (!existing) {
          db.insert(licitacaoFornecedores)
            .values({
              licitacaoId: licitacao.id,
              fornecedorId: fornecedor.id,
              valorHomologado: r.valorTotalHomologado,
              itemDescricao: r.itemDescricao,
              numeroItem: r.numeroItem,
              dataResultado: r.dataResultado,
            })
            .run();
        }
      }
    }
  }

  // 7. Build response grouped by unique CNPJ
  const result: FornecedorComEmail[] = [];

  for (const cnpj of uniqueCnpjs) {
    const data = cnpjDataMap.get(cnpj)!;
    const relatedResults = pjResultados.filter(
      (r) => cleanCnpj(r.niFornecedor) === cnpj
    );

    result.push({
      cnpj,
      razaoSocial: data.razaoSocial ?? relatedResults[0]?.nomeRazaoSocialFornecedor ?? null,
      nomeFantasia: data.nomeFantasia,
      email: data.email,
      emailSource: data.emailSource,
      emailCategory: data.emailCategory,
      telefones: data.telefones,
      municipio: data.municipio,
      uf: data.uf,
      porte: relatedResults[0]?.porteFornecedorNome ?? null,
      valorHomologado: relatedResults.reduce(
        (sum, r) => sum + (r.valorTotalHomologado ?? 0),
        0
      ),
      itemDescricao: relatedResults.map((r) => r.itemDescricao).join("; "),
    });
  }

  return result;
}
