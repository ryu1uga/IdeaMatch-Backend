import { z } from "zod";
import { crud } from "../../lib/crud.js";
import { atLeastOne, idQuery, idRef } from "../../lib/schemas.js";
import { ESTADO_MIEMBRO } from "../../domain/enums.js";

export const miembrosEquipoModule = crud({
  model: "miembroEquipo",
  base: "/miembros-equipo",
  tag: "Miembros de equipo",
  tagDescription: "Colaboradores que ocupan un rol en un proyecto.",
  singular: "miembro",
  list: {
    filters: z.object({ rolProyectoId: idQuery, usuarioId: idQuery, estado: z.enum(ESTADO_MIEMBRO).optional() }),
    orderBy: { fechaIngreso: "desc" },
    include: {
      usuario: { select: { id: true, perfil: { select: { nombreVisible: true } } } },
      rolProyecto: { select: { id: true, nombre: true, proyectoId: true } },
    },
  },
  include: { usuario: { select: { id: true, perfil: true } }, rolProyecto: true },
  create: { body: z.object({ usuarioId: idRef, rolProyectoId: idRef }) },
  update: {
    description: "Si el estado deja de ser Activo se registra fechaBaja. motivoBaja es obligatorio para Removido.",
    body: atLeastOne(
      z.object({
        estado: z.enum(ESTADO_MIEMBRO).optional(),
        motivoBaja: z.string().max(2000).nullable().optional(),
      }),
    ),
    data: (b) => ({
      ...b,
      fechaBaja: b.estado === undefined ? undefined : b.estado === "Activo" ? null : new Date(),
    }),
  },
});
