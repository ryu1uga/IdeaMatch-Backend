import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

export interface AuthPayload {
  sub: string; // id del usuario (BigInt serializado)
  email: string;
  rolGlobal: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthPayload;
  }
}

/** Exige un header "Authorization: Bearer <token>" válido. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw HttpError.unauthorized("Falta el token");

  try {
    req.user = jwt.verify(header.slice(7), env.JWT_SECRET) as AuthPayload;
    next();
  } catch {
    throw HttpError.unauthorized("Token inválido o expirado");
  }
};
