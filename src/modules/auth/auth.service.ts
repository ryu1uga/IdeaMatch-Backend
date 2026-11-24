import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { ESTADOS_USUARIO_BLOQUEADOS, type TipoToken } from "../../domain/enums.js";
import { mailer } from "../../lib/mailer.js";
import { HttpError } from "../../utils/http-error.js";
import type { AuthPayload } from "../../middlewares/auth.js";
import type {
  EmailInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from "./auth.schemas.js";
import { correoRecuperacion, correoVerificacion } from "./auth.emails.js";
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

// ---------- Códigos de 6 dígitos (verificación de correo y recuperación de contraseña)
export const CODIGO_MINUTOS = 15;
export const CODIGO_MAX_INTENTOS = 5;
/** Espera mínima entre dos envíos del mismo tipo de código a la misma cuenta */
export const CODIGO_ESPERA_REENVIO_MS = 60 * 1000;

const PENDIENTE = "Pendiente_Verificacion";

const generarCodigo = () => randomInt(0, 1_000_000).toString().padStart(6, "0");

// En la BD solo se guarda un HMAC del código (con JWT_SECRET), nunca el código en claro.
// Incluir usuario y tipo hace que dos cuentas con el mismo código no choquen en token.valor (UNIQUE).
const hashCodigo = (usuarioId: bigint, tipo: TipoToken, codigo: string) =>
  createHmac("sha256", env.JWT_SECRET).update(`${tipo}:${usuarioId}:${codigo}`).digest("hex");

const codigoInvalido = (details?: unknown) =>
  HttpError.badRequest("El código no es válido o ya venció", "INVALID_CODE", details);

const seleccionCodigo = { id: true, nombres: true, email: true, estado: true } as const;
type UsuarioCodigo = { id: bigint; nombres: string; email: string };

/**
 * Genera un código nuevo (invalida los anteriores del mismo tipo) y lo envía por correo.
 * Devuelve false si se pidió otro hace menos de CODIGO_ESPERA_REENVIO_MS (no se reenvía).
 */
async function emitirCodigo(u: UsuarioCodigo, tipo: TipoToken) {
  const reciente = await prisma.token.findFirst({
    where: { usuarioId: u.id, tipo, usado: false, fechaCreacion: { gt: new Date(Date.now() - CODIGO_ESPERA_REENVIO_MS) } },
    select: { id: true },
  });
  if (reciente) return false;

  const codigo = generarCodigo();
  await prisma.$transaction([
    prisma.token.deleteMany({ where: { usuarioId: u.id, tipo } }),
    prisma.token.create({
      data: {
        usuarioId: u.id,
        tipo,
        valor: hashCodigo(u.id, tipo, codigo),
        expiraEn: new Date(Date.now() + CODIGO_MINUTOS * 60 * 1000),
      },
    }),
  ]);

  const datos = { nombre: u.nombres, codigo, minutos: CODIGO_MINUTOS };
  const correo = tipo === "Verificacion_Email" ? correoVerificacion(datos) : correoRecuperacion(datos);
  try {
    await mailer.enviar({ to: u.email, ...correo });
  } catch (err) {
    // Sin correo enviado el código no sirve: se borra para que se pueda pedir otro de inmediato
    await prisma.token.deleteMany({ where: { usuarioId: u.id, tipo } });
    console.error(`[mail] no se pudo enviar el código (${tipo}) a ${u.email}`, err);
    throw new HttpError(502, "EMAIL_SEND_FAILED", "No pudimos enviar el correo. Inténtalo de nuevo en unos minutos.");
  }
  return true;
}

/** Valida y consume un código. Cada intento fallido cuenta; al llegar al máximo el código se invalida. */
async function consumirCodigo(email: string, tipo: TipoToken, codigo: string) {
  const u = await prisma.usuario.findUnique({ where: { email: email.toLowerCase() }, select: seleccionCodigo });
  if (!u) throw codigoInvalido();

  const t = await prisma.token.findFirst({
    where: { usuarioId: u.id, tipo, usado: false, expiraEn: { gt: new Date() } },
    orderBy: { fechaCreacion: "desc" },
    select: { id: true, valor: true, intentos: true },
  });
  if (!t) throw codigoInvalido();

  const esperado = Buffer.from(t.valor, "hex");
  const recibido = Buffer.from(hashCodigo(u.id, tipo, codigo), "hex");
  if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) {
    const intentos = t.intentos + 1;
    const restantes = Math.max(0, CODIGO_MAX_INTENTOS - intentos);
    await prisma.token.update({ where: { id: t.id }, data: { intentos, usado: restantes === 0 } });
    throw codigoInvalido({ attemptsLeft: restantes });
  }

  // updateMany con usado=false: si llegan dos peticiones a la vez, solo una lo consume
  const { count } = await prisma.token.updateMany({ where: { id: t.id, usado: false }, data: { usado: true } });
  if (count !== 1) throw codigoInvalido();
  return u;
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
        estado: env.REQUIRE_EMAIL_VERIFICATION ? PENDIENTE : "Activo",
        // Usuario + Perfil (1:1) en una sola operación
        perfil: { create: { nombreVisible: `${input.firstName} ${input.lastName}`.slice(0, 100) } },
      },
      select: userSelect,
    });

    if (!env.REQUIRE_EMAIL_VERIFICATION) return { token: firmarToken(usuario), user: toUserDto(usuario) };

    // La cuenta ya existe aunque falle el correo: el usuario puede pedir otro código con resend-verification
    const emailSent = await emitirCodigo(usuario, "Verificacion_Email").catch(() => false);
    return { user: toUserDto(usuario), verificationRequired: true, emailSent };
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
    if (u.estado === PENDIENTE && env.REQUIRE_EMAIL_VERIFICATION) {
      throw HttpError.forbidden(
        "Tu cuenta aún no está verificada. Revisa tu correo e ingresa el código.",
        "EMAIL_NOT_VERIFIED",
      );
    }
    return { token: firmarToken(u), user: toUserDto(u) };
  },

  /** Confirma el correo con el código y deja la sesión iniciada. */
  async verifyEmail(input: VerifyEmailInput) {
    const u = await consumirCodigo(input.email, "Verificacion_Email", input.code);
    const usuario = await prisma.usuario.update({
      where: { id: u.id },
      // Si la cuenta estaba suspendida o dada de baja, verificar el correo no la reactiva
      data: u.estado === PENDIENTE ? { estado: "Activo" } : {},
      select: { ...userSelect, estado: true },
    });
    if (ESTADOS_USUARIO_BLOQUEADOS.includes(usuario.estado)) {
      throw HttpError.forbidden("La cuenta está suspendida o dada de baja", "ACCOUNT_DISABLED");
    }
    return { token: firmarToken(usuario), user: toUserDto(usuario) };
  },

  /** Reenvía el código de verificación. Responde igual exista o no la cuenta. */
  async resendVerification(input: EmailInput) {
    const u = await prisma.usuario.findUnique({ where: { email: input.email.toLowerCase() }, select: seleccionCodigo });
    if (u?.estado === PENDIENTE) await emitirCodigo(u, "Verificacion_Email");
  },

  /** Envía un código para restablecer la contraseña. Responde igual exista o no la cuenta. */
  async forgotPassword(input: EmailInput) {
    const u = await prisma.usuario.findUnique({ where: { email: input.email.toLowerCase() }, select: seleccionCodigo });
    if (u && !ESTADOS_USUARIO_BLOQUEADOS.includes(u.estado)) await emitirCodigo(u, "Reset_Password");
  },

  async resetPassword(input: ResetPasswordInput) {
    if (!esPasswordFuerte(input.newPassword)) {
      throw HttpError.badRequest(
        "La contraseña debe tener al menos 8 caracteres, una mayúscula y un número",
        "WEAK_PASSWORD",
      );
    }
    const u = await consumirCodigo(input.email, "Reset_Password", input.code);
    if (ESTADOS_USUARIO_BLOQUEADOS.includes(u.estado)) {
      throw HttpError.forbidden("La cuenta está suspendida o dada de baja", "ACCOUNT_DISABLED");
    }
    await prisma.usuario.update({
      where: { id: u.id },
      data: {
        passwordHash: await bcrypt.hash(input.newPassword, 10),
        // El código llegó a su correo: eso también confirma que el correo es suyo
        ...(u.estado === PENDIENTE ? { estado: "Activo" } : {}),
      },
    });
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
