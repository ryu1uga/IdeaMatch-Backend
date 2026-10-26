import { z } from "zod";
import { crud } from "../../lib/crud.js";
import { idQuery, idRef } from "../../lib/schemas.js";

export const conversacionesModule = crud({
  model: "conversacion",
  base: "/conversaciones",
  tag: "Conversaciones",
  tagDescription: "Chat grupal de cada proyecto (se crea automáticamente al crear el proyecto).",
  singular: "conversación",
  list: {
    filters: z.object({ proyectoId: idQuery }),
    include: { proyecto: { select: { id: true, titulo: true } }, _count: { select: { mensajes: true } } },
  },
  include: { proyecto: { select: { id: true, titulo: true } }, _count: { select: { mensajes: true } } },
  create: { body: z.object({ proyectoId: idRef }) },
  update: false,
});
