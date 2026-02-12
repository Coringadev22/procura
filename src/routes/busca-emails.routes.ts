import type { FastifyInstance } from "fastify";
import { runEmailSearch } from "../services/email-search.service.js";

export async function buscaEmailsRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: {
      q?: string;
      uf?: string;
      minResultados?: string;
      dataInicial?: string;
      dataFinal?: string;
    };
  }>("/api/busca-emails", async (request) => {
    return runEmailSearch({
      q: request.query.q || "",
      uf: request.query.uf?.toUpperCase(),
      minResultados: request.query.minResultados
        ? Math.min(Number(request.query.minResultados), 200)
        : 20,
      dataInicial: request.query.dataInicial,
      dataFinal: request.query.dataFinal,
    });
  });
}
