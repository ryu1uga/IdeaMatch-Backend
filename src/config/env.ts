import "dotenv/config";
import { z } from "zod";

const opcional = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatorio"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("1d"),
  CORS_ORIGIN: z.string().default("*"),

  // Proxies delante de la API (Render = 1). Necesario para que el rate limit vea la IP real.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // Intentos permitidos por IP cada 15 min en /auth/login y /auth/register
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(20),

  // Almacenamiento de archivos: si hay CLOUDINARY_URL se usa Cloudinary,
  // si no, disco local (solo para desarrollo: en Render el disco se borra).
  CLOUDINARY_URL: opcional
    // tolera el error común de pegar la línea completa del dashboard ("CLOUDINARY_URL=cloudinary://...") o con comillas
    .transform((v) => v?.replace(/^CLOUDINARY_URL=/i, "").replace(/^["']|["']$/g, ""))
    .refine((v) => !v || /^cloudinary:\/\/[^:]+:[^@]+@.+$/i.test(v), {
      message: "Debe tener la forma cloudinary://API_KEY:API_SECRET@CLOUD_NAME (o dejarse vacía)",
    }),
  UPLOAD_DIR: z.string().default("uploads"),
  // URL pública de la API para armar las URLs de archivos locales (p. ej. http://localhost:3000)
  PUBLIC_URL: opcional,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variables de entorno inválidas:");
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;

// El SDK de Cloudinary lee process.env.CLOUDINARY_URL al importarse: se deja el valor ya limpio
if (env.CLOUDINARY_URL) process.env.CLOUDINARY_URL = env.CLOUDINARY_URL;
else delete process.env.CLOUDINARY_URL;
