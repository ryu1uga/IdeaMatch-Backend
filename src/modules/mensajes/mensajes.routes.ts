import { z } from "zod";
import { crud } from "../../lib/crud.js";
import { idQuery, idRef } from "../../lib/schemas.js";

export const mensajesModule = crud({
  model: "mensaje",
  base: "/mensajes",
  tag: "Mensajes",
  tagDescription: "Mensajes de una conversación.",
  singular: "mensaje",
  list: {
    filters: z.object({ conversacionId: idQuery, autorId: idQuery }),
    orderBy: { fechaEnvio: "desc" },
    include: { autor: { select: { id: true, perfil: { select: { nombreVisible: true } } } }, adjuntos: true },
  },
  include: { autor: { select: { id: true, perfil: { select: { nombreVisible: true } } } }, adjuntos: true },
  create: {
    description: "El autor es el usuario autenticado.",
    body: z.object({ conversacionId: idRef, contenido: z.string().trim().min(1).max(5000) }),
    data: (b, ctx) => ({ ...b, autorId: ctx.userId }),
  },
  update: { body: z.object({ contenido: z.string().trim().min(1).max(5000) }) },
});
