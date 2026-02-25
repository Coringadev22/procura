import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { healthRoutes } from "./routes/health.routes.js";
import { licitacoesRoutes } from "./routes/licitacoes.routes.js";
import { contratosRoutes } from "./routes/contratos.routes.js";
import { fornecedoresRoutes } from "./routes/fornecedores.routes.js";
import { dashboardRoutes } from "./routes/dashboard.routes.js";
import { buscaEmailsRoutes } from "./routes/busca-emails.routes.js";
import { resendRoutes } from "./routes/resend.routes.js";
import { automationRoutes } from "./routes/automation.routes.js";
import { leadsRoutes } from "./routes/leads.routes.js";
import { startAutomationScheduler, cancelAllJobs } from "./services/automation.service.js";
import { seedCampaignTemplates, startDailyCampaignScheduler, stopDailyCampaignScheduler } from "./services/campaign.service.js";
import { whatsappRoutes } from "./routes/whatsapp.routes.js";
import { initializeInstance } from "./services/whatsapp.service.js";
import { startDailyWhatsAppScheduler, stopDailyWhatsAppScheduler } from "./services/whatsapp-campaign.service.js";

const app = Fastify({
  logger: false,
  requestTimeout: 600_000,
});

// Plugins
await app.register(cors, { origin: true });
await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

// Routes
await app.register(healthRoutes);
await app.register(licitacoesRoutes);
await app.register(contratosRoutes);
await app.register(fornecedoresRoutes);
await app.register(buscaEmailsRoutes);
await app.register(resendRoutes);
await app.register(automationRoutes);
await app.register(leadsRoutes);
await app.register(whatsappRoutes);
await app.register(dashboardRoutes);

// Global error handler
app.setErrorHandler((error, request, reply) => {
  logger.error(`Error: ${error.message}`);
  const statusCode = error.statusCode ?? 500;
  reply.status(statusCode).send({
    error: statusCode >= 500 ? "Erro interno do servidor" : error.message,
  });
});

// Start
try {
  await app.listen({ port: env.PORT, host: env.HOST });

  await startAutomationScheduler();
  await seedCampaignTemplates();
  startDailyCampaignScheduler();

  // WhatsApp (only if configured)
  if (env.WHATSAPP_ENABLED) {
    await initializeInstance();
    // WhatsApp campaign scheduler desativado por enquanto (disparo manual apenas)
    // startDailyWhatsAppScheduler();
  }

  logger.info(`Servidor rodando em http://localhost:${env.PORT}`);
  logger.info(`Dashboard visual: http://localhost:${env.PORT}/`);
  logger.info("Endpoints disponíveis:");
  logger.info("  GET /api/health");
  logger.info("  GET /api/licitacoes/search?q=&uf=&pagina=&tamanhoPagina=");
  logger.info("  GET /api/licitacoes/:orgaoCnpj/:anoCompra/:seq");
  logger.info("  GET /api/licitacoes/:orgaoCnpj/:anoCompra/:seq/fornecedores");
  logger.info("  GET /api/contratos/search?dataInicial=&dataFinal=&uf=");
  logger.info("  GET /api/fornecedores/:cnpj");
  logger.info("  GET /api/fornecedores/search?uf=&municipio=&hasEmail=");
  logger.info("  GET/POST/PUT/DELETE /api/automation/jobs");
  logger.info("  POST /api/email/send-test | /api/email/preview-template");
} catch (err) {
  logger.error(err);
  process.exit(1);
}

process.on("SIGINT", () => {
  cancelAllJobs();
  stopDailyCampaignScheduler();
  stopDailyWhatsAppScheduler();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cancelAllJobs();
  stopDailyCampaignScheduler();
  stopDailyWhatsAppScheduler();
  process.exit(0);
});
