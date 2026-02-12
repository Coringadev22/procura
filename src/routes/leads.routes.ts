import type { FastifyInstance } from "fastify";
import { eq, like, and, isNotNull, sql } from "drizzle-orm";
import { db } from "../config/database.js";
import { leads } from "../db/schema.js";

export async function leadsRoutes(app: FastifyInstance) {
  // List leads (with optional filters)
  app.get<{
    Querystring: { categoria?: string; cnae?: string };
  }>("/api/leads", async (request) => {
    const { categoria, cnae } = request.query;
    const conditions = [];

    if (categoria && categoria !== "all") {
      conditions.push(eq(leads.categoria, categoria));
    }
    if (cnae) {
      conditions.push(like(leads.cnaePrincipal, `%${cnae}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const data = await db.select().from(leads).where(where);
    return data;
  });

  // Stats
  app.get("/api/leads/stats", async () => {
    const all = await db.select().from(leads);
    const total = all.length;
    const comEmail = all.filter((l) => l.email).length;
    const empresas = all.filter((l) => l.categoria === "empresa").length;
    const provContab = all.filter((l) => l.categoria === "provavel_contabilidade").length;
    const contabilidades = all.filter((l) => l.categoria === "contabilidade").length;
    return { total, comEmail, empresas, provContab, contabilidades };
  });

  // Add single lead
  app.post<{
    Body: {
      cnpj: string;
      razaoSocial?: string;
      nomeFantasia?: string;
      email?: string;
      telefones?: string;
      municipio?: string;
      uf?: string;
      cnaePrincipal?: string;
      origem?: string;
      valorHomologado?: number;
      categoria?: string;
    };
  }>("/api/leads", async (request, reply) => {
    const body = request.body;
    const cnpj = body.cnpj.replace(/\D/g, "");
    if (!cnpj) return reply.status(400).send({ error: "CNPJ obrigatorio" });

    // Check duplicate
    const [existing] = await db.select().from(leads).where(eq(leads.cnpj, cnpj));
    if (existing) {
      return reply.status(409).send({ error: "Lead ja existe", duplicado: true });
    }

    // Check duplicate by email
    if (body.email) {
      const [byEmail] = await db.select().from(leads).where(eq(leads.email, body.email.toLowerCase()));
      if (byEmail) {
        return reply.status(409).send({ error: "Email ja existe nos leads", duplicado: true });
      }
    }

    const [result] = await db.insert(leads).values({
      cnpj,
      razaoSocial: body.razaoSocial || null,
      nomeFantasia: body.nomeFantasia || null,
      email: body.email?.toLowerCase() || null,
      telefones: body.telefones || null,
      municipio: body.municipio || null,
      uf: body.uf || null,
      cnaePrincipal: body.cnaePrincipal || null,
      origem: body.origem || "manual",
      valorHomologado: body.valorHomologado || null,
      categoria: body.categoria || "empresa",
    }).returning({ id: leads.id });

    return { success: true, id: result.id };
  });

  // Batch add leads
  app.post<{
    Body: {
      leads: Array<{
        cnpj: string;
        razaoSocial?: string;
        nomeFantasia?: string;
        email?: string;
        telefones?: string;
        municipio?: string;
        uf?: string;
        cnaePrincipal?: string;
        origem?: string;
        valorHomologado?: number;
        categoria?: string;
      }>;
    };
  }>("/api/leads/batch", async (request) => {
    const items = request.body.leads;
    let added = 0;
    let skipped = 0;

    for (const item of items) {
      const cnpj = item.cnpj.replace(/\D/g, "");
      if (!cnpj) { skipped++; continue; }

      const [existing] = await db.select({ id: leads.id }).from(leads).where(eq(leads.cnpj, cnpj));
      if (existing) { skipped++; continue; }

      if (item.email) {
        const [byEmail] = await db.select({ id: leads.id }).from(leads).where(eq(leads.email, item.email.toLowerCase()));
        if (byEmail) { skipped++; continue; }
      }

      await db.insert(leads).values({
        cnpj,
        razaoSocial: item.razaoSocial || null,
        nomeFantasia: item.nomeFantasia || null,
        email: item.email?.toLowerCase() || null,
        telefones: item.telefones || null,
        municipio: item.municipio || null,
        uf: item.uf || null,
        cnaePrincipal: item.cnaePrincipal || null,
        origem: item.origem || "manual",
        valorHomologado: item.valorHomologado || null,
        categoria: item.categoria || "empresa",
      });
      added++;
    }

    return { added, skipped, total: items.length };
  });

  // Remove lead by CNPJ
  app.delete<{ Params: { cnpj: string } }>(
    "/api/leads/:cnpj",
    async (request) => {
      const cnpj = request.params.cnpj.replace(/\D/g, "");
      await db.delete(leads).where(eq(leads.cnpj, cnpj));
      return { success: true };
    }
  );

  // Clear all leads
  app.delete("/api/leads", async () => {
    await db.delete(leads);
    return { success: true };
  });

  // Toggle categoria
  app.patch<{ Params: { cnpj: string } }>(
    "/api/leads/:cnpj/categoria",
    async (request) => {
      const cnpj = request.params.cnpj.replace(/\D/g, "");
      const [lead] = await db.select().from(leads).where(eq(leads.cnpj, cnpj));
      if (!lead) return { error: "Lead nao encontrado" };

      const cycle: Record<string, string> = {
        empresa: "provavel_contabilidade",
        provavel_contabilidade: "contabilidade",
        contabilidade: "empresa",
      };
      const next = cycle[lead.categoria] || "empresa";

      await db.update(leads)
        .set({ categoria: next })
        .where(eq(leads.cnpj, cnpj));

      return { success: true, categoria: next };
    }
  );
}
