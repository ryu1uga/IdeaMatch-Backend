import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { ESTADOS_USUARIO_BLOQUEADOS } from "../../domain/enums.js";
import { HttpError } from "../../utils/http-error.js";
import type { AuthPayload } from "../../middlewares/auth.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";
import { toUserDto, userSelect } from "./user.dto.js";

const emailValido = z.email();

/** ≥ 8 caracteres, al menos una mayúscula y un número */
export function esPasswordFuerte(p: string) {
  return p.length >= 8 && /[A-Z]/.test(p) && /\d/.test(p);
}

// Hash fijo para comparar aunque el correo no exista (mismo tiempo de respuesta)
const HASH_FALSO = bcrypt.hashSync("password-que-no-existe-Aa1", 10);

function firmarToken(u: { id: bigint; email: string }) {
  return jwt.sign({ sub: u.id.toString(), email: u.email }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    jwtid: randomUUID(),
  });
}

export const authService = {
  async register(input: RegisterInput) {
    const email = input.email.toLowerCase();
    if (!emailValido.safeParse(email).success) {
      throw HttpError.conflict("El correo no es válido o ya está registrado", "EMAIL_TAKEN_OR_INVALID");
    }
    if (!esPasswordFuerte(input.password)) {
      throw HttpError.badRequest(
        "La contraseña debe tener al menos 8 caracteres, una mayúscula y un número",
        "WEAK_PASSWORD",
      );
    }

    const existe = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
    if (existe) throw HttpError.conflict("El correo no es válido o ya está registrado", "EMAIL_TAKEN_OR_INVALID");

    const usuario = await prisma.usuario.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(input.password, 10),
        nombres: input.firstName,
        apellidos: input.lastName,
        estado: "Activo",
        // Usuario + Perfil (1:1) en una sola operación
        perfil: { create: { nombreVisible: `${input.firstName} ${input.lastName}`.slice(0, 100) } },
      },
      select: userSelect,
    });

    return { token: firmarToken(usuario), user: toUserDto(usuario) };
  },

  async login(input: LoginInput) {
    const email = input.email.toLowerCase();
    // passwordHash se omite globalmente (lib/prisma.ts); aquí sí se necesita
    const u = await prisma.usuario.findUnique({
      where: { email },
      select: { ...userSelect, estado: true, passwordHash: true },
    });
    const ok = await bcrypt.compare(input.password, u?.passwordHash ?? HASH_FALSO);
    // Mismo mensaje si el correo no existe o la contraseña es incorrecta
    if (!u || !ok) throw HttpError.unauthorized("Correo o contraseña incorrectos", "INVALID_CREDENTIALS");

    if (ESTADOS_USUARIO_BLOQUEADOS.includes(u.estado)) {
      throw HttpError.forbidden("La cuenta está suspendida o dada de baja", "ACCOUNT_DISABLED");
    }
    return { token: firmarToken(u), user: toUserDto(u) };
  },

  /** Revoca el token actual. Aprovecha para limpiar los revocados ya vencidos. */
  async logout(payload: AuthPayload) {
    await prisma.$transaction([
      prisma.tokenRevocado.deleteMany({ where: { expiraEn: { lt: new Date() } } }),
      prisma.tokenRevocado.upsert({
        where: { jti: payload.jti },
        update: {},
        create: { jti: payload.jti, usuarioId: BigInt(payload.sub), expiraEn: new Date(payload.exp * 1000) },
      }),
    ]);
  },

  async me(id: bigint) {
    const u = await prisma.usuario.findUniqueOrThrow({ where: { id }, select: userSelect });
    return { user: toUserDto(u) };
  },
};
