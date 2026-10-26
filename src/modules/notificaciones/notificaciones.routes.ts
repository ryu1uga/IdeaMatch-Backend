import { z } from "zod";
import { crud } from "../../lib/crud.js";
import { atLeastOne, boolQuery, idQuery, idRef } from "../../lib/schemas.js";
import { ENTIDAD_REF_NOTIFICACION, TIPO_NOTIFICACION } from "../../domain/enums.js";

export const notificacionesModule = crud({
  model: "notificacion",
  base: "/notificaciones",
  tag: "Notificaciones",
  tagDescription: "Notificaciones dentro de la plataforma.",
  singular: "notificación",
  list: {
    filters: z.object({ usuarioId: idQuery, leida: boolQuery, tipo: z.enum(TIPO_NOTIFICACION).optional() }),
    orderBy: { fechaCreacion: "desc" },
  },
  include: { emails: true },
  create: {
    body: z.object({
      usuarioId: idRef,
      tipo: z.enum(TIPO_NOTIFICACION),
      mensaje: z.string().trim().min(1).max(500),
      entidadRefTipo: z.enum(ENTIDAD_REF_NOTIFICACION).optional(),
      entidadRefId: idRef.optional(),
    }),
  },
  update: {
    description: "Al marcar leida=true se registra fechaLectura.",
    body: atLeastOne(z.object({ leida: z.boolean().optional(), mensaje: z.string().trim().min(1).max(500).optional() })),
    data: (b) => ({
      ...b,
      fechaLectura: b.leida === undefined ? undefined : b.leida ? new Date() : null,
    }),
  },
});
