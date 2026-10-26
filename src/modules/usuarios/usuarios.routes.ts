import bcrypt from "bcryptjs";
import { z } from "zod";
import { crud } from "../../lib/crud.js";
import { atLeastOne, idParam, searchQuery } from "../../lib/schemas.js";
import { ESTADO_USUARIO, ROL_GLOBAL } from "../../domain/enums.js";

const email = z.email().max(255).transform((e) => e.toLowerCase());
const password = z.string().min(8).max(72);

export const usuariosModule = crud({
  model: "usuario",
  base: "/usuarios",
  tag: "Usuarios",
  tagDescription: "Cuentas de usuario. El password_hash nunca se devuelve.",
  singular: "usuario",
  list: {
    filters: z.object({
      q: searchQuery.meta({ description: "Busca en el email" }),
      estado: z.enum(ESTADO_USUARIO).optional(),
      rolGlobal: z.enum(ROL_GLOBAL).optional(),
    }),
    where: ({ q, estado, rolGlobal }) => ({
      estado,
      rolGlobal,
      ...(q ? { email: { contains: q as string, mode: "insensitive" } } : {}),
    }),
    include: { perfil: { select: { nombreVisible: true, fotoUrl: true } } },
  },
  include: { perfil: true },
  create: {
    description: "Crea la cuenta (y opcionalmente su perfil). Para auto-registro usa /api/auth/register.",
    body: z.object({
      email,
      password,
      rolGlobal: z.enum(ROL_GLOBAL),
      estado: z.enum(ESTADO_USUARIO).optional(),
      nombreVisible: z.string().trim().min(1).max(100).optional().meta({ description: "Si se envía, crea el perfil" }),
    }),
    data: async ({ password, nombreVisible, ...rest }) => ({
      ...rest,
      passwordHash: await bcrypt.hash(password as string, 10),
      perfil: nombreVisible ? { create: { nombreVisible } } : undefined,
    }),
  },
  update: {
    body: atLeastOne(
      z.object({
        email: email.optional(),
        password: password.optional(),
        rolGlobal: z.enum(ROL_GLOBAL).optional(),
        estado: z.enum(ESTADO_USUARIO).optional(),
      }),
    ),
    data: async ({ password, ...rest }) => ({
      ...rest,
      passwordHash: password ? await bcrypt.hash(password as string, 10) : undefined,
    }),
  },
  remove: { soft: { estado: "Baja" }, description: "No borra la cuenta: cambia su estado a 'Baja'." },
  idParams: z.object({ id: idParam }),
});
