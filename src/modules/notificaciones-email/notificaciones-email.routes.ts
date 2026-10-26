import { z } from "zod";
import { crud } from "../../lib/crud.js";
import { atLeastOne, idQuery, idRef } from "../../lib/schemas.js";
import { ESTADO_EMAIL, MAX_INTENTOS_EMAIL } from "../../domain/enums.js";

export const notificacionesEmailModule = crud({
  model: "notificacionEmail",
  base: "/notificaciones-email",
  tag: "Notificaciones email",
  tagDescription: "Log de envío por correo de cada notificación (máximo 3 intentos).",
  singular: "registro de email",
  list: { filters: z.object({ notificacionId: idQuery, estado: z.enum(ESTADO_EMAIL).optional() }) },
  create: { body: z.object({ notificacionId: idRef, destinatarioEmail: z.email().max(255) }) },
  update: {
    description: "Al cambiar estado o intentos se registra fechaUltimoIntento.",
    body: atLeastOne(
      z.object({
        estado: z.enum(ESTADO_EMAIL).optional(),
        intentos: z.number().int().min(0).max(MAX_INTENTOS_EMAIL).optional(),
        errorDetalle: z.string().nullable().optional(),
      }),
    ),
    data: (b) => ({
      ...b,
      fechaUltimoIntento: b.estado !== undefined || b.intentos !== undefined ? new Date() : undefined,
    }),
  },
});
