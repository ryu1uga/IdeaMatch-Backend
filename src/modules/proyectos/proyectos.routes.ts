import { z } from "zod";
import { crud } from "../../lib/crud.js";
import { atLeastOne, idQuery, idRef, searchQuery } from "../../lib/schemas.js";
import { ESTADO_PROYECTO } from "../../domain/enums.js";

const rolNuevo = z.object({
  nombre: z.string().trim().min(1).max(100),
  vacantes: z.number().int().min(1).max(100),
});

export const proyectosModule = crud({
  model: "proyecto",
  base: "/proyectos",
  tag: "Proyectos",
  tagDescription: "Proyectos publicados por los creadores.",
  singular: "proyecto",
  publicRead: true,
  list: {
    filters: z.object({
      q: searchQuery.meta({ description: "Busca en título y resumen" }),
      estado: z.enum(ESTADO_PROYECTO).optional(),
      categoriaId: idQuery,
      creadorId: idQuery,
    }),
    where: ({ q, ...f }) => ({
      ...f,
      ...(q
        ? {
            OR: [
              { titulo: { contains: q as string, mode: "insensitive" } },
              { resumen: { contains: q as string, mode: "insensitive" } },
            ],
          }
        : {}),
    }),
    orderBy: { fechaPublicacion: "desc" },
    include: {
      categoria: { select: { id: true, nombre: true } },
      creador: { select: { id: true, perfil: { select: { nombreVisible: true } } } },
      roles: { select: { id: true, nombre: true, vacantesTotales: true, vacantesDisponibles: true } },
    },
  },
  include: {
    categoria: true,
    creador: { select: { id: true, perfil: true } },
    roles: true,
    conversacion: true,
    entregas: true,
  },
  create: {
    description:
      "El creador es el usuario autenticado. Se crea también la conversación grupal del proyecto y, si se envían, sus roles.",
    body: z.object({
      titulo: z.string().trim().min(1).max(150),
      resumen: z.string().trim().min(1).max(300),
      descripcion: z.string().optional(),
      categoriaId: idRef.optional(),
      roles: z
        .array(rolNuevo)
        .optional()
        .refine((r) => !r || new Set(r.map((x) => x.nombre.toLowerCase())).size === r.length, "Roles repetidos"),
    }),
    data: ({ roles, ...rest }, ctx) => ({
      ...rest,
      creadorId: ctx.userId,
      conversacion: { create: {} },
      roles: roles
        ? {
            create: (roles as z.infer<typeof rolNuevo>[]).map((r) => ({
              nombre: r.nombre,
              vacantesTotales: r.vacantes,
              vacantesDisponibles: r.vacantes,
            })),
          }
        : undefined,
    }),
  },
  update: {
    body: atLeastOne(
      z.object({
        titulo: z.string().trim().min(1).max(150).optional(),
        resumen: z.string().trim().min(1).max(300).optional(),
        descripcion: z.string().nullable().optional(),
        categoriaId: idRef.nullable().optional(),
        estado: z.enum(ESTADO_PROYECTO).optional(),
      }),
    ),
  },
  remove: "hard",
});
