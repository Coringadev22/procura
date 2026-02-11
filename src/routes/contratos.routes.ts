import type { FastifyInstance } from "fastify";
import { searchContratos } from "../services/pncp-consulta.service.js";
import type { ContratoSearchResult } from "../types/api.types.js";

export async function contratosRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: {
      dataInicial: string;
      dataFinal: string;
      uf?: string;
      pagina?: string;
      tamanhoPagina?: string;
    };
  }>("/api/contratos/search", async (request, reply) => {
    const { dataInicial, dataFinal, uf, pagina, tamanhoPagina } =
      request.query;

    if (!dataInicial || !dataFinal) {
      return reply.status(400).send({
        error: "Parâmetros 'dataInicial' e 'dataFinal' são obrigatórios (formato: YYYYMMDD)",
      });
    }

    const result = await searchContratos({
      dataInicial,
      dataFinal,
      uf,
      pagina: pagina ? Number(pagina) : 1,
      tamanhoPagina: tamanhoPagina ? Number(tamanhoPagina) : 20,
    });

    const data: ContratoSearchResult[] = result.data.map((c) => ({
      numeroControlePNCP: c.numeroControlePNCP,
      orgaoCnpj: c.orgaoEntidade.cnpj,
      orgaoNome: c.orgaoEntidade.razaoSocial,
      fornecedorCnpj: c.niFornecedor,
      fornecedorNome: c.nomeRazaoSocialFornecedor,
      objetoContrato: c.objetoContrato,
      valorGlobal: c.valorGlobal,
      dataAssinatura: c.dataAssinatura,
      uf: c.unidadeOrgao.ufSigla,
      municipio: c.unidadeOrgao.municipioNome,
    }));

    return {
      data,
      total: result.totalRegistros,
      page: result.numeroPagina,
      totalPages: result.totalPaginas,
    };
  });
}
