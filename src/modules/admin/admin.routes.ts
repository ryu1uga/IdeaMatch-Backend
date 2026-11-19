import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { defineRoute } from "../../lib/route.js";
import { registerTag } from "../../lib/openapi.js";
import { prisma } from "../../lib/prisma.js";
import { idParam } from "../../lib/schemas.js";
import { personaSelect, toPersona } from "../../lib/persona.js";
import { SEVERIDAD_REPORTE } from "../../domain/enums.js";
import { statusFromDb } from "../../domain/proyecto.js";
import { HttpError } from "../../utils/http-error.js";
import { notificar } from "../notificaciones/notificaciones.service.js";
import { metricas } from "./metricas.service.js";

const router = Router();
const base = "/api";
const tag = "Administración";
registerTag(tag, "Sprint 8 — Solo administradores (`403 ADMIN_ONLY`). Métricas, moderación de reportes y categorías.");

const ESTADO_REPORTE_API = { abierto: ["Pendiente", "En_Revision"], resuelto: ["Resuelto", "Desestimado"] } as const;
const reportStatusFromDb = (e: string) => (e === "Resuelto" || e === "Desestimado" ? "resuelto" : "abierto");

// ---------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------

defineRoute(
  router,
  base,
  {
    method: "get",
    path: "/admin/metrics",
    tag,
    admin: true,
    summary: "Indicadores de la comunidad",
    description:
      "`200 { users, activeProjects, acceptanceRate, openReports, updatedAt, stale }`; cada indicador es `{ value, changeThisMonth }`.\n\n" +
      "- `users`: registrados (sin bajas) · nuevos este mes.\n- `activeProjects`: abiertos o en curso · publicados este mes.\n" +
      "- `acceptanceRate`: % de aceptadas sobre resueltas · diferencia en puntos vs. el mes anterior (`null` sin datos).\n" +
      "- `openReports`: reportes sin resolver · recibidos este mes.\n\n" +
      "Si el cálculo falla se devuelve el último valor en caché con `stale: true` (o `503 METRICS_UNAVAILABLE` si no hay caché).",
  },
  () => metricas(),
);

// ---------------------------------------------------------------------------
// Reportes
// ---------------------------------------------------------------------------

const reporteSelect = {
  id: true,
  idEntidad: true,
  categoria: true,
  severidad: true,
  motivo: true,
  estado: true,
  resolucion: true,
  fechaReporte: true,
  fechaResolucion: true,
  reportante: { select: personaSelect },
  admin: { select: personaSelect },
} as const satisfies Prisma.ReporteSelect;

type ReporteRow = Prisma.ReporteGetPayload<{ select: typeof reporteSelect }>;

async function toReportDtos(rows: ReporteRow[]) {
  const proyectos = await prisma.proyecto.findMany({
    where: { id: { in: rows.map((r) => r.idEntidad) } },
    select: { id: true, titulo: true, estado: true },
  });
  const porId = new Map(proyectos.map((p) => [String(p.id), p]));
  return rows.map((r) => {
    const p = porId.get(String(r.idEntidad));
    return {
      id: r.id,
      project: p ? { id: p.id, name: p.titulo, status: statusFromDb(p.estado) } : { id: r.idEntidad, name: null, status: null },
      reason: r.categoria,
      description: r.motivo,
      severity: r.severidad,
      status: reportStatusFromDb(r.estado),
      resolution: r.estado === "Resuelto" ? "suspend_project" : r.estado === "Desestimado" ? "dismiss" : null,
      note: r.resolucion,
      createdAt: r.fechaReporte,
      resolvedAt: r.fechaResolucion,
      reporter: toPersona(r.reportante),
      resolvedBy: r.admin ? toPersona(r.admin) : null,
    };
  });
}

defineRoute(
  router,
  base,
  {
    method: "get",
    path: "/admin/reports",
    tag,
    admin: true,
    summary: "Cola de reportes",
    description:
      "`200 { items: [{ id, project { id, name, status }, reason, description, severity, status, resolution, note, createdAt, resolvedAt, reporter, resolvedBy }], total, page, limit }`, más recientes primero.",
    query: z.object({
      status: z.enum(["abierto", "resuelto"]).optional(),
      severity: z.enum(SEVERIDAD_REPORTE).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
  },
  async ({ query }) => {
    const where: Prisma.ReporteWhereInput = {
      tipoEntidad: "Proyecto",
      ...(query.status && { estado: { in: [...ESTADO_REPORTE_API[query.status]] } }),
      ...(query.severity && { severidad: query.severity }),
    };
    const [total, rows] = await Promise.all([
      prisma.reporte.count({ where }),
      prisma.reporte.findMany({
        where,
        orderBy: [{ fechaReporte: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: reporteSelect,
      }),
    ]);
    return { items: await toReportDtos(rows), total, page: query.page, limit: query.limit };
  },
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/admin/reports/:id/resolve",
    tag,
    admin: true,
    summary: "Resolver reporte",
    description:
      "`action`:\n- `suspend_project`: el proyecto pasa a `suspendido` (oculto en el catálogo, sin edición ni postulaciones), " +
      "se cierran sus postulaciones pendientes y sus otros reportes abiertos, y se notifica al creador y a los reportantes.\n" +
      "- `dismiss`: el reporte se desestima y se notifica al reportante.\n\n" +
      "`200 { report }` · `404 REPORT_NOT_FOUND` · `409 ALREADY_RESOLVED`.",
    params: z.object({ id: idParam }),
    body: z.object({
      action: z.enum(["suspend_project", "dismiss"]),
      note: z.string().trim().max(2000).optional().transform((v) => v || null),
    }),
    status: 200,
  },
  async ({ params, body, userId }) => {
    const r = await prisma.reporte.findUnique({
      where: { id: params.id },
      select: { id: true, estado: true, idEntidad: true, tipoEntidad: true, reportanteId: true },
    });
    if (!r || r.tipoEntidad !== "Proyecto") throw HttpError.notFound("El reporte no existe", "REPORT_NOT_FOUND");
    if (r.estado === "Resuelto" || r.estado === "Desestimado") {
      throw HttpError.conflict("El reporte ya fue resuelto", "ALREADY_RESOLVED");
    }
    const proyecto = await prisma.proyecto.findUnique({
      where: { id: r.idEntidad },
      select: { id: true, titulo: true, creadorId: true, estado: true },
    });
    const ahora = new Date();
    const resolucion = { adminId: userId, resolucion: body.note, fechaResolucion: ahora };

    if (body.action === "dismiss") {
      await prisma.reporte.update({ where: { id: r.id }, data: { ...resolucion, estado: "Desestimado" } });
      await notificar([r.reportanteId], {
        tipo: "Reporte_Resuelto",
        mensaje: `Revisamos tu reporte sobre ${proyecto?.titulo ?? "un proyecto"} y no encontramos una infracción`,
        ref: { tipo: "Reporte", id: r.id },
        payload: { reportId: r.id, projectId: r.idEntidad, projectName: proyecto?.titulo ?? null, action: "dismiss" },
      });
    } else {
      if (!proyecto) throw HttpError.notFound("El proyecto reportado ya no existe", "PROJECT_NOT_FOUND");
      // Todos los reportes abiertos del mismo proyecto quedan resueltos con esta acción
      const abiertos = await prisma.reporte.findMany({
        where: { tipoEntidad: "Proyecto", idEntidad: proyecto.id, estado: { in: ["Pendiente", "En_Revision"] } },
        select: { id: true, reportanteId: true },
      });
      const pendientes = await prisma.postulacion.findMany({
        where: { proyectoId: proyecto.id, estado: "Pendiente" },
        select: { id: true, usuarioId: true, rolProyectoId: true, rolProyecto: { select: { nombre: true } } },
      });
      await prisma.$transaction([
        prisma.proyecto.update({ where: { id: proyecto.id }, data: { estado: "Suspendido" } }),
        prisma.reporte.updateMany({ where: { id: { in: abiertos.map((x) => x.id) } }, data: { ...resolucion, estado: "Resuelto" } }),
        prisma.postulacion.updateMany({
          where: { proyectoId: proyecto.id, estado: "Pendiente" },
          data: { estado: "Rechazada", fechaResolucion: ahora },
        }),
      ]);
      await notificar([proyecto.creadorId], {
        tipo: "Proyecto_Suspendido",
        mensaje: `Tu proyecto ${proyecto.titulo} fue suspendido por moderación${body.note ? `: ${body.note}` : ""}`,
        ref: { tipo: "Proyecto", id: proyecto.id },
        payload: { projectId: proyecto.id, projectName: proyecto.titulo, note: body.note },
      });
      await notificar(
        abiertos.map((x) => x.reportanteId),
        {
          tipo: "Reporte_Resuelto",
          mensaje: `Gracias por tu reporte: el proyecto ${proyecto.titulo} fue suspendido`,
          ref: { tipo: "Proyecto", id: proyecto.id },
          payload: { projectId: proyecto.id, projectName: proyecto.titulo, action: "suspend_project" },
        },
      );
      for (const a of pendientes) {
        await notificar([a.usuarioId], {
          tipo: "Postulacion_Rechazada",
          mensaje: `Tu postulación a ${a.rolProyecto.nombre} en ${proyecto.titulo} se cerró porque el proyecto fue suspendido`,
          ref: { tipo: "Postulacion", id: a.id },
          payload: { projectId: proyecto.id, projectName: proyecto.titulo, roleId: a.rolProyectoId, roleName: a.rolProyecto.nombre, applicationId: a.id, reason: "project_suspended" },
        });
      }
    }

    const row = await prisma.reporte.findUniqueOrThrow({ where: { id: r.id }, select: reporteSelect });
    return { report: (await toReportDtos([row]))[0] };
  },
);

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

const categoriaSelect = {
  id: true,
  nombre: true,
  activa: true,
  fechaCreacion: true,
  _count: { select: { proyectos: { where: { estado: { not: "Borrador" } } } } },
} as const satisfies Prisma.CategoriaSelect;

const toCategoryDto = (c: Prisma.CategoriaGetPayload<{ select: typeof categoriaSelect }>) => ({
  id: c.id,
  name: c.nombre,
  active: c.activa,
  projectCount: c._count.proyectos,
  createdAt: c.fechaCreacion,
});

async function nombreLibre(nombre: string, exceptoId?: bigint) {
  const existe = await prisma.categoria.findFirst({
    where: { nombre: { equals: nombre, mode: "insensitive" }, ...(exceptoId && { id: { not: exceptoId } }) },
    select: { id: true },
  });
  if (existe) throw HttpError.conflict("Ya existe una categoría con ese nombre", "CATEGORY_EXISTS");
}

const nombreCategoria = z.string().trim().min(1, "Obligatorio").max(100).meta({ example: "Agrotech" });

defineRoute(
  router,
  base,
  {
    method: "get",
    path: "/admin/categories",
    tag,
    admin: true,
    summary: "Todas las categorías",
    description: "Incluye las inactivas. `200 [{ id, name, active, projectCount, createdAt }]`.",
  },
  async () => (await prisma.categoria.findMany({ orderBy: { nombre: "asc" }, select: categoriaSelect })).map(toCategoryDto),
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/admin/categories",
    tag,
    admin: true,
    summary: "Crear categoría",
    description: "`201 { category }` · `409 CATEGORY_EXISTS` (sin distinguir mayúsculas).",
    body: z.object({ name: nombreCategoria }),
  },
  async ({ body }) => {
    await nombreLibre(body.name);
    const c = await prisma.categoria.create({ data: { nombre: body.name }, select: categoriaSelect });
    return { category: toCategoryDto(c) };
  },
);

defineRoute(
  router,
  base,
  {
    method: "patch",
    path: "/admin/categories/:id",
    tag,
    admin: true,
    summary: "Editar o activar/desactivar categoría",
    description:
      "Una categoría inactiva no aparece en `GET /categories` ni se puede elegir en proyectos nuevos; los existentes la conservan.\n\n" +
      "`200 { category }` · `409 CATEGORY_EXISTS` · `404 CATEGORY_NOT_FOUND`.",
    params: z.object({ id: idParam }),
    body: z
      .object({ name: nombreCategoria.optional(), active: z.boolean().optional() })
      .refine((b) => b.name !== undefined || b.active !== undefined, "Envía name o active"),
  },
  async ({ params, body }) => {
    const existe = await prisma.categoria.count({ where: { id: params.id } });
    if (!existe) throw HttpError.notFound("La categoría no existe", "CATEGORY_NOT_FOUND");
    if (body.name) await nombreLibre(body.name, params.id);
    const c = await prisma.categoria.update({
      where: { id: params.id },
      data: { nombre: body.name, activa: body.active },
      select: categoriaSelect,
    });
    return { category: toCategoryDto(c) };
  },
);


export const adminModule = { base: "/", router };
