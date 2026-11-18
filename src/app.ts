import "./lib/bigint.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { LOCAL_UPLOAD_DIR, storage } from "./lib/storage.js";
import { prisma } from "./lib/prisma.js";
import { router } from "./routes.js";
import { buildOpenApiDocument } from "./lib/openapi.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";

export const app = express();
app.set("trust proxy", env.TRUST_PROXY);

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

// ---------- Archivos subidos en disco local (solo si no hay Cloudinary)
if (storage.driver === "local") {
  app.use(
    "/uploads",
    (_req, res, next) => {
      // el front (otro origen) debe poder mostrar las imágenes
      res.set({ "Cross-Origin-Resource-Policy": "cross-origin", "X-Content-Type-Options": "nosniff" });
      next();
    },
    express.static(LOCAL_UPLOAD_DIR, { index: false, fallthrough: false }),
  );
}

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
