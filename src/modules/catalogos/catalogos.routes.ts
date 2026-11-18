import { Router } from "express";
import { z } from "zod";
import { defineRoute } from "../../lib/route.js";
import { registerTag } from "../../lib/openapi.js";
import { prisma } from "../../lib/prisma.js";
import { searchQuery } from "../../lib/schemas.js";

const router = Router();
const tag = "Catálogos";
registerTag(tag, "Sprint 2 — Habilidades y categorías activas.");

defineRoute(
  router,
  "/api",
  {
    method: "get",
    path: "/skills",
    tag,
    summary: "Buscar habilidades",
    description: "`200 [{ id, name }]` (máximo 50, ordenadas por nombre).",
    query: z.object({ q: searchQuery }),
  },
  async ({ query }) => {
    const rows = await prisma.habilidad.findMany({
      where: { activa: true, tipo: "Tecnica", ...(query.q && { nombre: { contains: query.q, mode: "insensitive" } }) },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
      take: 50,
    });
    return rows.map((h) => ({ id: h.id, name: h.nombre }));
  },
);

defineRoute(
  router,
  "/api",
  {
    method: "get",
    path: "/categories",
    tag,
    summary: "Listar categorías",
    description: "Pública. `200 [{ id, name, projectCount }]`; `projectCount` cuenta los proyectos abiertos.",
    auth: false,
  },
  async () => {
    const rows = await prisma.categoria.findMany({
      where: { activa: true },
      select: { id: true, nombre: true, _count: { select: { proyectos: { where: { estado: "Abierto" } } } } },
      orderBy: { nombre: "asc" },
    });
    return rows.map((c) => ({ id: c.id, name: c.nombre, projectCount: c._count.proyectos }));
  },
);

export const catalogosModule = { base: "/", router };
