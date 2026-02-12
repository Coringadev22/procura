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
import { gmailRoutes } from "./routes/gmail.routes.js";
import { automationRoutes } from "./routes/automation.routes.js";
import { startAutomationScheduler, cancelAllJobs } from "./services/automation.service.js";

const app = Fastify({
  logger: false,
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
await app.register(gmailRoutes);
await app.register(automationRoutes);
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

  startAutomationScheduler();

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
  logger.info("  POST /api/gmail/send-test | /api/gmail/preview-template");
} catch (err) {
  logger.error(err);
  process.exit(1);
}

process.on("SIGINT", () => {
  cancelAllJobs();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cancelAllJobs();
  process.exit(0);
});
