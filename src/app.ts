import "./lib/bigint.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { router } from "./routes.js";
import { buildOpenApiDocument } from "./lib/openapi.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";

export const app = express();

// ---------- Swagger (antes de helmet para que su CSP no bloquee la UI)
const openApiDoc = buildOpenApiDocument();
app.get("/docs.json", (_req, res) => res.json(openApiDoc));
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiDoc, {
    customSiteTitle: "IdeaMatch API",
    swaggerOptions: { persistAuthorization: true, docExpansion: "none", tryItOutEnabled: true },
  }),
);
app.get("/", (_req, res) => res.redirect("/docs"));

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",") }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", db: "ok", timestamp: new Date().toISOString() });
});

app.use("/api", router);

app.use(notFoundHandler);
app.use(errorHandler);
