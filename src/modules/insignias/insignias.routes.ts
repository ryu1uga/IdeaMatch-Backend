import { z } from "zod";
import { crud } from "../../lib/crud.js";
import { atLeastOne, boolQuery, searchQuery } from "../../lib/schemas.js";

export const insigniasModule = crud({
  model: "insignia",
  base: "/insignias",
  tag: "Insignias",
  tagDescription: "Catálogo de insignias.",
  singular: "insignia",
  publicRead: true,
  list: {
    filters: z.object({ q: searchQuery, activa: boolQuery }),
    where: ({ q, activa }) => ({ activa, ...(q ? { nombre: { contains: q as string, mode: "insensitive" } } : {}) }),
    orderBy: { nombre: "asc" },
  },
  create: {
    body: z.object({
      nombre: z.string().trim().min(1).max(100),
      descripcion: z.string().max(300).optional(),
      criterio: z.string().optional(),
    }),
  },
  update: {
    body: atLeastOne(
      z.object({
        nombre: z.string().trim().min(1).max(100).optional(),
        descripcion: z.string().max(300).nullable().optional(),
        criterio: z.string().nullable().optional(),
        activa: z.boolean().optional(),
      }),
    ),
  },
  remove: { soft: { activa: false } },
});
