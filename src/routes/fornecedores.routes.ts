import type { FastifyInstance } from "fastify";
import { eq, and, isNotNull, like } from "drizzle-orm";
import { db } from "../config/database.js";
import { fornecedores } from "../db/schema.js";
import { lookupCnpj } from "../services/cnpj-lookup.service.js";
import { cleanCnpj, isValidCnpj } from "../utils/cnpj.js";
import { mergePhones } from "../utils/phone.js";

export async function fornecedoresRoutes(app: FastifyInstance) {
  // Lookup single CNPJ
  app.get<{
    Params: { cnpj: string };
  }>("/api/fornecedores/:cnpj", async (request, reply) => {
    const cnpj = cleanCnpj(request.params.cnpj);

    if (!isValidCnpj(cnpj)) {
      return reply.status(400).send({ error: "CNPJ inválido" });
    }

    const data = await lookupCnpj(cnpj);
    return { data };
  });

  // Search cached fornecedores
  app.get<{
    Querystring: {
      uf?: string;
      municipio?: string;
      hasEmail?: string;
      pagina?: string;
      tamanhoPagina?: string;
    };
  }>("/api/fornecedores/search", async (request) => {
    const { uf, municipio, hasEmail, pagina, tamanhoPagina } = request.query;
    const page = pagina ? Number(pagina) : 1;
    const pageSize = tamanhoPagina ? Number(tamanhoPagina) : 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (uf) {
      conditions.push(eq(fornecedores.uf, uf.toUpperCase()));
    }
    if (municipio) {
      conditions.push(
        like(fornecedores.municipio, `%${municipio.toUpperCase()}%`)
      );
    }
    if (hasEmail === "true") {
      conditions.push(isNotNull(fornecedores.email));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select()
      .from(fornecedores)
      .where(where)
      .limit(pageSize)
      .offset(offset);

    return {
      data: results,
      total: results.length,
      page,
      pageSize,
    };
  });

  // Normalize phones in fornecedores cache
  app.post("/api/fornecedores/normalize-phones", async () => {
    const all = await db.select().from(fornecedores);
    const hasPhones = all.filter((f) => f.telefones && f.telefones.trim() !== "");
    let normalized = 0;

    for (const f of hasPhones) {
      const nPhones = mergePhones(f.telefones);
      if (nPhones !== f.telefones) {
        await db.update(fornecedores)
          .set({ telefones: nPhones })
          .where(eq(fornecedores.cnpj, f.cnpj));
        normalized++;
      }
    }

    return { total: all.length, withPhones: hasPhones.length, normalized };
  });
}
