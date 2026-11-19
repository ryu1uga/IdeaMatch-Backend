import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { ESTADOS_USUARIO_BLOQUEADOS } from "../domain/enums.js";
import { HttpError } from "../utils/http-error.js";

/** Contenido del JWT */
export interface AuthPayload {
  sub: string; // id del usuario (BigInt serializado)
  jti: string; // id único del token (para revocarlo en el logout)
  email: string;
  exp: number; // segundos desde epoch (lo agrega jsonwebtoken)
  /** se lee de la BD en cada request (no del token), para que quitar el rol tenga efecto inmediato */
  isAdmin?: boolean;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthPayload;
  }
}

/** Lee y verifica un JWT (firma, vencimiento, revocación y estado del usuario). */
export async function verifyAccessToken(token: string): Promise<AuthPayload> {
  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
  } catch {
    throw HttpError.unauthorized("Token inválido o expirado", "INVALID_TOKEN");
  }
  if (!payload.sub || !payload.jti) throw HttpError.unauthorized("Token inválido o expirado", "INVALID_TOKEN");

  const [revocado, usuario] = await Promise.all([
    prisma.tokenRevocado.findUnique({ where: { jti: payload.jti }, select: { jti: true } }),
    prisma.usuario.findUnique({ where: { id: BigInt(payload.sub) }, select: { estado: true, esAdmin: true } }),
  ]);
  if (revocado || !usuario) throw HttpError.unauthorized("La sesión ya no es válida", "INVALID_TOKEN");
  if (ESTADOS_USUARIO_BLOQUEADOS.includes(usuario.estado)) {
    throw HttpError.forbidden("La cuenta está suspendida o dada de baja", "ACCOUNT_DISABLED");
  }
  return { ...payload, isAdmin: usuario.esAdmin };
}

/** Exige un header "Authorization: Bearer <token>" válido. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw HttpError.unauthorized("Falta el token");
  req.user = await verifyAccessToken(header.slice(7));
  next();
};

/** Exige que el usuario autenticado sea administrador (va después de requireAuth) */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user?.isAdmin) throw HttpError.forbidden("Solo para administradores", "ADMIN_ONLY");
  next();
};
