import { z } from "zod";
import { crud } from "../../lib/crud.js";
import { atLeastOne, boolQuery, searchQuery } from "../../lib/schemas.js";
import { TIPO_HABILIDAD } from "../../domain/enums.js";

export const habilidadesModule = crud({
  model: "habilidad",
  base: "/habilidades",
  tag: "Habilidades",
  tagDescription: "Catálogo de habilidades técnicas y áreas de interés.",
  singular: "habilidad",
  publicRead: true,
  list: {
    filters: z.object({ q: searchQuery, tipo: z.enum(TIPO_HABILIDAD).optional(), activa: boolQuery }),
    where: ({ q, tipo, activa }) => ({
      tipo,
      activa,
      ...(q ? { nombre: { contains: q as string, mode: "insensitive" } } : {}),
    }),
    orderBy: { nombre: "asc" },
  },
  create: {
    body: z.object({ nombre: z.string().trim().min(1).max(100), tipo: z.enum(TIPO_HABILIDAD) }),
  },
  update: {
    body: atLeastOne(
      z.object({
        nombre: z.string().trim().min(1).max(100).optional(),
        tipo: z.enum(TIPO_HABILIDAD).optional(),
        activa: z.boolean().optional(),
      }),
    ),
  },
  remove: { soft: { activa: false } },
});
