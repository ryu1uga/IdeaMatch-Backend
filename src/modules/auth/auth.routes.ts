import { Router } from "express";
import { defineRoute } from "../../lib/route.js";
import { registerTag } from "../../lib/openapi.js";
import { emailSchema, loginSchema, registerSchema, resetPasswordSchema, verifyEmailSchema } from "./auth.schemas.js";
import { authService, CODIGO_ESPERA_REENVIO_MS, CODIGO_MAX_INTENTOS, CODIGO_MINUTOS } from "./auth.service.js";
import { env } from "../../config/env.js";
import { authRateLimit } from "../../middlewares/rate-limit.js";

const router = Router();
const base = "/api/auth";
const tag = "Auth";
registerTag(
  tag,
  "Sprint 1 — Acceso. Registro con verificación de correo, inicio y cierre de sesión, y recuperación de contraseña. " +
    "Los códigos son de 6 dígitos, se envían por correo, vencen a los " +
    `${CODIGO_MINUTOS} minutos, son de un solo uso y se invalidan tras ${CODIGO_MAX_INTENTOS} intentos fallidos.`,
);

const reglaCodigo =
  `Errores del código: \`400 INVALID_CODE\` (incorrecto, vencido o ya usado; si fue incorrecto, \`details.attemptsLeft\`) · ` +
  "`400 VALIDATION` (no son 6 dígitos).";

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/register",
    tag,
    summary: "Registrar usuario",
    description:
      (env.REQUIRE_EMAIL_VERIFICATION
        ? "Crea la cuenta en estado pendiente y envía un código de 6 dígitos al correo. " +
          "Devuelve `201 { user, verificationRequired: true, emailSent }` **sin token**: la sesión se obtiene en " +
          "`POST /auth/verify-email`. Si `emailSent` es `false`, el usuario puede pedir otro código con `resend-verification`.\n\n"
        : "La cuenta queda activa de inmediato (REQUIRE_EMAIL_VERIFICATION=false). Devuelve `201 { token, user }`.\n\n") +
      "Errores: `409 EMAIL_TAKEN_OR_INVALID` · `400 WEAK_PASSWORD` (≥ 8, una mayúscula y un número) · " +
      "`429 TOO_MANY_REQUESTS`.",
    auth: false,
    body: registerSchema,
    middlewares: [authRateLimit],
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
    description:
      "Devuelve `200 { token, user }`. Errores: `401 INVALID_CREDENTIALS` (mismo mensaje si el correo no existe) · " +
      "`403 EMAIL_NOT_VERIFIED` (la cuenta no confirmó su correo) · `403 ACCOUNT_DISABLED`.",
    auth: false,
    body: loginSchema,
    middlewares: [authRateLimit],
    status: 200,
  },
  ({ body }) => authService.login(body),
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/verify-email",
    tag,
    summary: "Verificar correo con el código",
    description:
      "Confirma el correo con el código recibido al registrarse y deja la sesión iniciada: `200 { token, user }`.\n\n" +
      reglaCodigo,
    auth: false,
    body: verifyEmailSchema,
    middlewares: [authRateLimit],
    status: 200,
  },
  ({ body }) => authService.verifyEmail(body),
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/resend-verification",
    tag,
    summary: "Reenviar código de verificación",
    description:
      "Envía un código nuevo si la cuenta está pendiente de verificación (el anterior deja de servir). " +
      "Responde `204` exista o no la cuenta, para no revelar qué correos están registrados. " +
      `Si se pidió otro hace menos de ${CODIGO_ESPERA_REENVIO_MS / 1000} s, no se reenvía. ` +
      "Error: `502 EMAIL_SEND_FAILED` (el servicio de correo falló).",
    auth: false,
    body: emailSchema,
    middlewares: [authRateLimit],
  },
  async ({ body }) => {
    await authService.resendVerification(body);
  },
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/forgot-password",
    tag,
    summary: "Pedir código para restablecer la contraseña",
    description:
      "Envía un código de 6 dígitos al correo. Responde `204` exista o no la cuenta. " +
      `Si se pidió otro hace menos de ${CODIGO_ESPERA_REENVIO_MS / 1000} s, no se reenvía. ` +
      "Error: `502 EMAIL_SEND_FAILED`.",
    auth: false,
    body: emailSchema,
    middlewares: [authRateLimit],
  },
  async ({ body }) => {
    await authService.forgotPassword(body);
  },
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/reset-password",
    tag,
    summary: "Restablecer la contraseña con el código",
    description:
      "Cambia la contraseña con el código de `forgot-password`: `204`. Después se inicia sesión con `POST /auth/login`. " +
      "Si la cuenta estaba pendiente de verificación, también queda verificada.\n\n" +
      "Errores: `400 WEAK_PASSWORD` · " + reglaCodigo,
    auth: false,
    body: resetPasswordSchema,
    middlewares: [authRateLimit],
  },
  async ({ body }) => {
    await authService.resetPassword(body);
  },
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
