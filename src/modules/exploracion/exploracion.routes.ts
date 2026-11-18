import { Router } from "express";
import { z } from "zod";
import { defineRoute } from "../../lib/route.js";
import { registerTag } from "../../lib/openapi.js";
import { enumListQuery, idListQuery, idParam, searchQuery } from "../../lib/schemas.js";
import { DEDICATION, PROJECT_STATUS_PUBLIC } from "../../domain/proyecto.js";
import { exploracionService } from "./exploracion.service.js";

const router = Router();
const base = "/api";
const tag = "Exploración";
registerTag(tag, "Sprint 4 — Catálogo de proyectos (Inicio y Explorar) y vista detallada.");

const listQuery = z.object({
  q: searchQuery.meta({ description: "Busca en nombre, resumen y descripción" }),
  categoryIds: idListQuery,
  skillIds: idListQuery.meta({ description: "Proyectos con algún rol que pida alguna de estas habilidades (p. ej. 1,2)" }),
  availability: enumListQuery(DEDICATION).meta({
    description: "Dedicación de roles con vacantes libres: 5-10, 10-20, 20+ (separadas por comas)",
  }),
  status: enumListQuery(PROJECT_STATUS_PUBLIC).meta({ description: "Por defecto solo `abierto`" }),
  sort: z.enum(["recent", "popular"]).default("recent").meta({ description: "`popular` = más postulaciones" }),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

defineRoute(
  router,
  base,
  {
    method: "get",
    path: "/projects",
    tag,
    summary: "Catálogo de proyectos",
    description:
      "`200 { items: [projectCard], total, page, limit }`.\n\n" +
      "`projectCard`: `{ id, name, summary, category, coverColor, coverGradient, modality, status, publishedAt, " +
      "skills[], vacanciesAvailable, membersCount, memberInitials[], extraMembers }`.\n\n" +
      "La sección 'Proyectos listos para despegar' de Inicio usa `?limit=3`.",
    query: listQuery,
  },
  ({ query }) => exploracionService.list(query),
);

defineRoute(
  router,
  base,
  {
    method: "get",
    path: "/projects/:id",
    tag,
    summary: "Detalle del proyecto",
    description:
      "`200 { ...projectCard, description, creator, roles[], members[], isOwner, isMember, myApplication }`. " +
      "`myApplication` es la postulación del usuario autenticado (`{ id, roleId, status }`) o `null`.\n\n" +
      "Los borradores y cancelados solo los ve su creador. `404 PROJECT_NOT_FOUND`.",
    params: z.object({ id: idParam }),
  },
  ({ params, userId }) => exploracionService.detail(params.id, userId),
);

export const exploracionModule = { base: "/", router };
