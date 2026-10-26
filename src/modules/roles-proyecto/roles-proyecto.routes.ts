import { z } from "zod";
import { crud } from "../../lib/crud.js";
import { atLeastOne, idQuery, idRef } from "../../lib/schemas.js";

export const rolesProyectoModule = crud({
  model: "rolProyecto",
  base: "/roles-proyecto",
  tag: "Roles de proyecto",
  tagDescription: "Vacantes que define cada proyecto (p. ej. 'Backend Developer').",
  singular: "rol",
  publicRead: true,
  list: { filters: z.object({ proyectoId: idQuery }), orderBy: { id: "asc" } },
  include: { proyecto: { select: { id: true, titulo: true, creadorId: true } } },
  create: {
    description: "Si no se envía vacantesDisponibles, se iguala a vacantesTotales.",
    body: z.object({
      proyectoId: idRef,
      nombre: z.string().trim().min(1).max(100),
      vacantesTotales: z.number().int().min(1).max(100),
      vacantesDisponibles: z.number().int().min(0).max(100).optional(),
    }),
    data: (b) => ({ ...b, vacantesDisponibles: b.vacantesDisponibles ?? b.vacantesTotales }),
  },
  update: {
    body: atLeastOne(
      z.object({
        nombre: z.string().trim().min(1).max(100).optional(),
        vacantesTotales: z.number().int().min(1).max(100).optional(),
        vacantesDisponibles: z.number().int().min(0).max(100).optional(),
      }),
    ),
  },
});
