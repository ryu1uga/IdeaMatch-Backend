import { z } from "zod";
import { crud } from "../../lib/crud.js";
import { idParam, idQuery, idRef } from "../../lib/schemas.js";

export const usuarioInsigniasModule = crud({
  model: "usuarioInsignia",
  base: "/usuario-insignias",
  tag: "Insignias de usuario",
  tagDescription: "Insignias obtenidas por cada usuario (clave compuesta usuarioId + insigniaId).",
  singular: "insignia de usuario",
  publicRead: true,
  idParams: z.object({ usuarioId: idParam, insigniaId: idParam }),
  whereUnique: ({ usuarioId, insigniaId }) => ({ usuarioId_insigniaId: { usuarioId, insigniaId } }),
  list: {
    filters: z.object({ usuarioId: idQuery, insigniaId: idQuery, proyectoId: idQuery }),
    orderBy: { fechaObtencion: "desc" },
    include: { insignia: true },
  },
  include: { insignia: true, proyecto: { select: { id: true, titulo: true } } },
  create: { body: z.object({ usuarioId: idRef, insigniaId: idRef, proyectoId: idRef.optional() }) },
  update: { body: z.object({ proyectoId: idRef.nullable() }) },
});
