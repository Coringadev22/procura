import type { FastifyInstance } from "fastify";
import { eq, like, and, isNotNull, sql } from "drizzle-orm";
import { db } from "../config/database.js";
import { leads } from "../db/schema.js";
import { classifyLead } from "../utils/email-category.js";
import { mergePhones, isMobilePhone, parsePhoneList } from "../utils/phone.js";

export async function leadsRoutes(app: FastifyInstance) {
  // List leads (with optional filters)
  app.get<{
    Querystring: { categoria?: string; cnae?: string; uf?: string };
  }>("/api/leads", async (request) => {
    const { categoria, cnae, uf } = request.query;
    const conditions = [];

    if (categoria && categoria !== "all") {
      conditions.push(eq(leads.categoria, categoria));
    }
    if (cnae) {
      conditions.push(like(leads.cnaePrincipal, `%${cnae}%`));
    }
    if (uf && uf !== "all") {
      conditions.push(eq(leads.uf, uf.toUpperCase()));
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
    const contabilidades = all.filter((l) => l.categoria === "contabilidade").length;
    const emailsSent = all.reduce((sum, l) => sum + (l.emailSentCount ?? 0), 0);
    const leadsEmailed = all.filter((l) => (l.emailSentCount ?? 0) > 0).length;
    return { total, comEmail, empresas, contabilidades, emailsSent, leadsEmailed };
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
      fonte?: string;
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

    const normalizedPhones = mergePhones(body.telefones || null);
    const hasMobile = normalizedPhones
      ? parsePhoneList(normalizedPhones).some(isMobilePhone)
      : false;

    const [result] = await db.insert(leads).values({
      cnpj,
      razaoSocial: body.razaoSocial || null,
      nomeFantasia: body.nomeFantasia || null,
      email: body.email?.toLowerCase() || null,
      telefones: normalizedPhones,
      municipio: body.municipio || null,
      uf: body.uf || null,
      cnaePrincipal: body.cnaePrincipal || null,
      origem: body.origem || "manual",
      fonte: body.fonte || null,
      valorHomologado: body.valorHomologado || null,
      categoria: body.categoria || "empresa",
      temCelular: hasMobile,
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
        fonte?: string;
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

      const nPhones = mergePhones(item.telefones || null);
      const hasMob = nPhones
        ? parsePhoneList(nPhones).some(isMobilePhone)
        : false;

      await db.insert(leads).values({
        cnpj,
        razaoSocial: item.razaoSocial || null,
        nomeFantasia: item.nomeFantasia || null,
        email: item.email?.toLowerCase() || null,
        telefones: nPhones,
        municipio: item.municipio || null,
        uf: item.uf || null,
        cnaePrincipal: item.cnaePrincipal || null,
        origem: item.origem || "manual",
        fonte: item.fonte || null,
        valorHomologado: item.valorHomologado || null,
        categoria: item.categoria || "empresa",
        temCelular: hasMob,
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
        empresa: "contabilidade",
        contabilidade: "empresa",
      };
      const next = cycle[lead.categoria] || "empresa";

      await db.update(leads)
        .set({ categoria: next })
        .where(eq(leads.cnpj, cnpj));

      return { success: true, categoria: next };
    }
  );

  // Reclassify all leads using email + CNAE + razao social
  app.post("/api/leads/reclassify", async () => {
    const allLeads = await db.select().from(leads);
    let reclassified = 0;
    const changes: Array<{ cnpj: string; from: string; to: string }> = [];

    for (const lead of allLeads) {
      const newCategoria = classifyLead(lead.email, lead.cnaePrincipal, lead.razaoSocial);
      if (newCategoria !== lead.categoria) {
        await db.update(leads)
          .set({ categoria: newCategoria })
          .where(eq(leads.id, lead.id));
        changes.push({ cnpj: lead.cnpj, from: lead.categoria, to: newCategoria });
        reclassified++;
      }
    }

    return { total: allLeads.length, reclassified, changes };
  });

  // Re-enrich leads without phones (or normalize existing)
  app.post("/api/leads/re-enrich-phones", async () => {
    const { lookupCnpj } = await import("../services/cnpj-lookup.service.js");

    // Get leads missing phones or with un-normalized phones
    const allLeads = await db.select().from(leads);
    const needsEnrich = allLeads.filter((l) => !l.telefones || l.telefones.trim() === "");

    let enriched = 0;
    let normalized = 0;
    let failed = 0;

    // First: normalize leads that already have phones but need temCelular flag
    const hasPhones = allLeads.filter((l) => l.telefones && l.telefones.trim() !== "");
    for (const lead of hasPhones) {
      const nPhones = mergePhones(lead.telefones);
      const hasMob = nPhones
        ? parsePhoneList(nPhones).some(isMobilePhone)
        : false;
      if (nPhones !== lead.telefones || lead.temCelular !== hasMob) {
        await db.update(leads)
          .set({ telefones: nPhones, temCelular: hasMob })
          .where(eq(leads.id, lead.id));
        normalized++;
      }
    }

    // Then: re-enrich leads without phones (rate limited by CNPJ lookup queues)
    for (const lead of needsEnrich) {
      try {
        const data = await lookupCnpj(lead.cnpj);
        if (data.telefones) {
          const nPhones = mergePhones(data.telefones);
          const hasMob = nPhones
            ? parsePhoneList(nPhones).some(isMobilePhone)
            : false;
          await db.update(leads)
            .set({
              telefones: nPhones,
              temCelular: hasMob,
              ...(data.email && !lead.email ? { email: data.email.toLowerCase() } : {}),
            })
            .where(eq(leads.id, lead.id));
          enriched++;
        }
      } catch (err) {
        failed++;
      }
    }

    return {
      total: allLeads.length,
      withPhones: hasPhones.length,
      normalized,
      needsEnrich: needsEnrich.length,
      enriched,
      failed,
    };
  });

  // Re-enrich leads missing razaoSocial (fixes BrasilAPI failures)
  app.post("/api/leads/re-enrich-names", async () => {
    const { lookupCnpj } = await import("../services/cnpj-lookup.service.js");

    const noName = await db.select().from(leads).where(
      and(
        sql`${leads.razaoSocial} IS NULL OR ${leads.razaoSocial} = ''`,
        sql`length(${leads.cnpj}) = 14`
      )
    );

    let fixed = 0;
    let failed = 0;
    let deleted = 0;

    for (const lead of noName) {
      try {
        const data = await lookupCnpj(lead.cnpj);
        if (data.razaoSocial) {
          const updates: Record<string, any> = {
            razaoSocial: data.razaoSocial,
          };
          if (data.nomeFantasia) updates.nomeFantasia = data.nomeFantasia;
          if (data.email && !lead.email) updates.email = data.email.toLowerCase();
          if (data.telefones && !lead.telefones) {
            const nPhones = mergePhones(data.telefones);
            updates.telefones = nPhones;
            updates.temCelular = nPhones
              ? parsePhoneList(nPhones).some(isMobilePhone)
              : false;
          }
          if (data.municipio && !lead.municipio) updates.municipio = data.municipio;
          if (data.uf && !lead.uf) updates.uf = data.uf;
          if (data.cnaePrincipal && !lead.cnaePrincipal) updates.cnaePrincipal = data.cnaePrincipal;

          await db.update(leads).set(updates).where(eq(leads.id, lead.id));
          fixed++;
        } else {
          // CNPJ not found in any API - remove invalid lead
          await db.delete(leads).where(eq(leads.id, lead.id));
          deleted++;
        }
      } catch {
        failed++;
      }
    }

    return { needsFix: noName.length, fixed, deleted, failed };
  });
}
