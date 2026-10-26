import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../config/env.js";

// Prisma 7 se conecta a PostgreSQL mediante un "driver adapter" (node-postgres).
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

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
