import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";

const usuarioPublico = {
  id: true,
  email: true,
  rolGlobal: true,
  estado: true,
  fechaRegistro: true,
  perfil: { select: { nombreVisible: true, fotoUrl: true } },
} as const;

function firmarToken(u: { id: bigint; email: string; rolGlobal: string }) {
  return jwt.sign({ sub: u.id.toString(), email: u.email, rolGlobal: u.rolGlobal }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

export const authService = {
  async register(input: RegisterInput) {
    const existe = await prisma.usuario.findUnique({ where: { email: input.email } });
    if (existe) throw HttpError.conflict("El email ya está registrado");

    const passwordHash = await bcrypt.hash(input.password, 10);

    // Usuario + Perfil (1:1) en una sola operación
    const usuario = await prisma.usuario.create({
      data: {
        email: input.email,
        passwordHash,
        rolGlobal: input.rolGlobal,
        perfil: { create: { nombreVisible: input.nombreVisible } },
      },
      select: usuarioPublico,
    });

    // TODO: crear Token tipo Verificacion_Email y enviar el correo.
    return { usuario, token: firmarToken(usuario) };
  },

  async login(input: LoginInput) {
    // passwordHash se omite globalmente (lib/prisma.ts); aquí sí se necesita
    const u = await prisma.usuario.findUnique({ where: { email: input.email }, omit: { passwordHash: false } });
    if (!u || !(await bcrypt.compare(input.password, u.passwordHash))) {
      throw HttpError.unauthorized("Credenciales inválidas");
    }
    if (u.estado === "Suspendido" || u.estado === "Baja") {
      throw HttpError.forbidden(`La cuenta está en estado ${u.estado}`);
    }
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: u.id }, select: usuarioPublico });
    return { usuario, token: firmarToken(u) };
  },

  me(id: bigint) {
    return prisma.usuario.findUniqueOrThrow({ where: { id }, select: usuarioPublico });
  },
};
