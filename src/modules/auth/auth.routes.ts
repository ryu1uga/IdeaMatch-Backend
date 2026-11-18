import { Router } from "express";
import { defineRoute } from "../../lib/route.js";
import { registerTag } from "../../lib/openapi.js";
import { loginSchema, registerSchema } from "./auth.schemas.js";
import { authService } from "./auth.service.js";

const router = Router();
const base = "/api/auth";
const tag = "Auth";
registerTag(tag, "Sprint 1 — Acceso. Registro, inicio y cierre de sesión. Devuelven el JWT que se usa en **Authorize**.");

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/register",
    tag,
    summary: "Registrar usuario",
    description:
      "La cuenta queda activa de inmediato (no hay verificación por correo). Devuelve `201 { token, user }`.\n\n" +
      "Errores: `409 EMAIL_TAKEN_OR_INVALID` · `400 WEAK_PASSWORD` (≥ 8, una mayúscula y un número).",
    auth: false,
    body: registerSchema,
  },
  ({ body }) => authService.register(body),
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/login",
    tag,
    summary: "Iniciar sesión",
    description: "Devuelve `200 { token, user }`. Error: `401 INVALID_CREDENTIALS` (mismo mensaje si el correo no existe).",
    auth: false,
    body: loginSchema,
    status: 200,
  },
  ({ body }) => authService.login(body),
);

defineRoute(
  router,
  base,
  { method: "post", path: "/logout", tag, summary: "Cerrar sesión", description: "Invalida el token actual. `204`." },
  async ({ req }) => {
    await authService.logout(req.user!);
  },
);

defineRoute(
  router,
  base,
  { method: "get", path: "/me", tag, summary: "Usuario autenticado", description: "`200 { user }`" },
  ({ userId }) => authService.me(userId),
);

export const authModule = { base: "/auth", router };
