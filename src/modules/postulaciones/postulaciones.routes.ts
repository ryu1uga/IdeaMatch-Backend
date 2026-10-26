import { z } from "zod";
import { crud } from "../../lib/crud.js";
import { prisma } from "../../lib/prisma.js";
import { atLeastOne, idQuery, idRef } from "../../lib/schemas.js";
import { ESTADO_POSTULACION } from "../../domain/enums.js";
import { HttpError } from "../../utils/http-error.js";

export const postulacionesModule = crud({
  model: "postulacion",
  base: "/postulaciones",
  tag: "Postulaciones",
  tagDescription: "Postulaciones de colaboradores a un rol. Un usuario solo puede postular a un rol por proyecto.",
  singular: "postulación",
  list: {
    filters: z.object({
      usuarioId: idQuery,
      proyectoId: idQuery,
      rolProyectoId: idQuery,
      estado: z.enum(ESTADO_POSTULACION).optional(),
    }),
    orderBy: { fechaPostulacion: "desc" },
    include: {
      usuario: { select: { id: true, perfil: { select: { nombreVisible: true } } } },
      rolProyecto: { select: { id: true, nombre: true } },
    },
  },
  include: {
    usuario: { select: { id: true, email: true, perfil: true } },
    rolProyecto: true,
    proyecto: { select: { id: true, titulo: true } },
  },
  create: {
    description: "El postulante es el usuario autenticado. El proyecto se obtiene del rol.",
    body: z.object({ rolProyectoId: idRef, notaPresentacion: z.string().max(2000).optional() }),
    data: async (b, ctx) => {
      const rol = await prisma.rolProyecto.findUnique({ where: { id: b.rolProyectoId as bigint } });
      if (!rol) throw HttpError.badRequest("El rol no existe");
      return { ...b, proyectoId: rol.proyectoId, usuarioId: ctx.userId };
    },
  },
  update: {
    description: "Al pasar a Aceptada o Rechazada se registra fechaResolucion.",
    body: atLeastOne(
      z.object({
        estado: z.enum(ESTADO_POSTULACION).optional(),
        notaPresentacion: z.string().max(2000).nullable().optional(),
      }),
    ),
    data: (b) => ({
      ...b,
      fechaResolucion: b.estado === "Aceptada" || b.estado === "Rechazada" ? new Date() : undefined,
    }),
  },
});
