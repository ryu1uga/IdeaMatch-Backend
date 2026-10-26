import { Router } from "express";
import { defineRoute } from "../../lib/route.js";
import { registerTag } from "../../lib/openapi.js";
import { loginSchema, registerSchema } from "./auth.schemas.js";
import { authService } from "./auth.service.js";

const router = Router();
const base = "/api/auth";
const tag = "Auth";
registerTag(tag, "Registro e inicio de sesión. Devuelven el JWT que se usa en **Authorize**.");

defineRoute(
  router,
  base,
  { method: "post", path: "/register", tag, summary: "Registrar usuario (crea también su perfil)", auth: false, body: registerSchema },
  ({ body }) => authService.register(body),
);

defineRoute(
  router,
  base,
  { method: "post", path: "/login", tag, summary: "Iniciar sesión", auth: false, body: loginSchema, status: 200 },
  ({ body }) => authService.login(body),
);

defineRoute(router, base, { method: "get", path: "/me", tag, summary: "Usuario autenticado" }, ({ userId }) =>
  authService.me(userId),
);

export const authModule = { base: "/auth", router };
