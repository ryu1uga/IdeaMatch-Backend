import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../config/env.js";
import { pgConfig } from "./db-config.js";

// Prisma 7 se conecta a PostgreSQL mediante un "driver adapter" (node-postgres).
// SSL según el sslmode de DATABASE_URL (ver lib/db-config.ts)
const adapter = new PrismaPg(pgConfig(env.DATABASE_URL, env.DATABASE_CA_CERT));

// Evita crear múltiples clientes cuando tsx recarga el código en desarrollo.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    // Nunca devolver el hash de la contraseña en las respuestas
    omit: { usuario: { passwordHash: true } },
    // Los errores de consulta los maneja middlewares/error-handler.ts
    log: ["warn"],
  });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
