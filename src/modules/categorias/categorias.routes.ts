import { z } from "zod";
import { crud } from "../../lib/crud.js";
import { atLeastOne, boolQuery, searchQuery } from "../../lib/schemas.js";

export const categoriasModule = crud({
  model: "categoria",
  base: "/categorias",
  tag: "Categorías",
  tagDescription: "Catálogo administrable de categorías de proyecto.",
  singular: "categoría",
  publicRead: true,
  list: {
    filters: z.object({ q: searchQuery, activa: boolQuery }),
    where: ({ q, activa }) => ({ activa, ...(q ? { nombre: { contains: q as string, mode: "insensitive" } } : {}) }),
    orderBy: { nombre: "asc" },
  },
  create: { body: z.object({ nombre: z.string().trim().min(1).max(100) }) },
  update: {
    body: atLeastOne(z.object({ nombre: z.string().trim().min(1).max(100).optional(), activa: z.boolean().optional() })),
  },
  remove: { soft: { activa: false } },
});
