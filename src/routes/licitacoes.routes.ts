import type { FastifyInstance } from "fastify";
import { searchLicitacoes } from "../services/pncp-search.service.js";
import { getContratacaoDetail } from "../services/pncp-consulta.service.js";
import { enrichLicitacao } from "../services/email-enrichment.service.js";
import { cleanCnpj, isValidCnpj } from "../utils/cnpj.js";
import type { LicitacaoSearchResult } from "../types/api.types.js";

export async function licitacoesRoutes(app: FastifyInstance) {
  // Search licitações by keyword
  app.get<{
    Querystring: {
      q: string;
      uf?: string;
      pagina?: string;
      tamanhoPagina?: string;
      dataInicial?: string;
      dataFinal?: string;
    };
  }>("/api/licitacoes/search", async (request, reply) => {
    const { q, uf, pagina, tamanhoPagina, dataInicial, dataFinal } = request.query;

    const result = await searchLicitacoes({
      q: q || "",
      uf,
      pagina: pagina ? Number(pagina) : 1,
      tamanhoPagina: tamanhoPagina ? Number(tamanhoPagina) : 20,
      dataInicial,
      dataFinal,
    });

    const data: LicitacaoSearchResult[] = result.items.map((item) => ({
      numeroControlePNCP: item.numero_controle_pncp,
      orgaoCnpj: item.orgao_cnpj,
      orgaoNome: item.orgao_nome,
      anoCompra: Number(item.ano),
      sequencialCompra: Number(item.numero_sequencial),
      objetoCompra: item.description,
      modalidade: item.modalidade_licitacao_nome,
      uf: item.uf,
      municipio: item.municipio_nome,
      valorEstimado: null,
      dataPublicacao: item.data_publicacao_pncp,
      situacao: item.situacao_nome,
      temResultado: item.tem_resultado,
    }));

    return { data, total: result.total };
  });

  // Get detail of a specific licitação
  app.get<{
    Params: {
      orgaoCnpj: string;
      anoCompra: string;
      seq: string;
    };
  }>("/api/licitacoes/:orgaoCnpj/:anoCompra/:seq", async (request, reply) => {
    const { orgaoCnpj, anoCompra, seq } = request.params;
    const cnpj = cleanCnpj(orgaoCnpj);

    if (!isValidCnpj(cnpj)) {
      return reply.status(400).send({ error: "CNPJ inválido" });
    }

    const detail = await getContratacaoDetail(
      cnpj,
      Number(anoCompra),
      Number(seq)
    );

    return { data: detail };
  });

  // Get fornecedores (suppliers with emails) for a licitação
  app.get<{
    Params: {
      orgaoCnpj: string;
      anoCompra: string;
      seq: string;
    };
  }>(
    "/api/licitacoes/:orgaoCnpj/:anoCompra/:seq/fornecedores",
    async (request, reply) => {
      const { orgaoCnpj, anoCompra, seq } = request.params;
      const cnpj = cleanCnpj(orgaoCnpj);

      if (!isValidCnpj(cnpj)) {
        return reply.status(400).send({ error: "CNPJ inválido" });
      }

      const fornecedores = await enrichLicitacao(
        cnpj,
        Number(anoCompra),
        Number(seq)
      );

      return {
        data: fornecedores,
        total: fornecedores.length,
        comEmail: fornecedores.filter((f) => f.email).length,
        semEmail: fornecedores.filter((f) => !f.email).length,
      };
    }
  );
}
