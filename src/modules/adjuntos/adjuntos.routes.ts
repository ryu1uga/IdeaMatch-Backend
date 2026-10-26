import { z } from "zod";
import { crud } from "../../lib/crud.js";
import { atLeastOne, idQuery, idRef } from "../../lib/schemas.js";
import { MAX_ADJUNTO_BYTES } from "../../domain/enums.js";

const tamano = z.number().int().min(0).max(MAX_ADJUNTO_BYTES).meta({ description: "Máximo 10 MB" });

export const adjuntosModule = crud({
  model: "adjunto",
  base: "/adjuntos",
  tag: "Adjuntos",
  tagDescription: "Archivos adjuntos a un mensaje (solo metadatos y URL).",
  singular: "adjunto",
  list: { filters: z.object({ mensajeId: idQuery }) },
  create: {
    body: z.object({
      mensajeId: idRef,
      url: z.url().max(500),
      tipoMime: z.string().min(3).max(100).meta({ example: "application/pdf" }),
      tamanoBytes: tamano,
    }),
  },
  update: {
    body: atLeastOne(
      z.object({ url: z.url().max(500).optional(), tipoMime: z.string().min(3).max(100).optional(), tamanoBytes: tamano.optional() }),
    ),
  },
});
