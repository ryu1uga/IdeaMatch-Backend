import { rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";

/** Límite de intentos por IP para login/registro (protección contra fuerza bruta) */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.AUTH_RATE_LIMIT,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test",
  handler: (_req, res) => {
    res.status(429).json({ code: "TOO_MANY_REQUESTS", message: "Demasiados intentos. Vuelve a intentarlo en unos minutos." });
  },
});
