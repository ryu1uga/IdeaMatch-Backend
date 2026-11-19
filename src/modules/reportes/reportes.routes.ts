import { Router } from "express";
import { z } from "zod";
import { defineRoute } from "../../lib/route.js";
import { registerTag } from "../../lib/openapi.js";
import { prisma } from "../../lib/prisma.js";
import { idParam } from "../../lib/schemas.js";
import { CATEGORIA_REPORTE } from "../../domain/enums.js";
import { HttpError } from "../../utils/http-error.js";
import { esOculto } from "../../domain/proyecto.js";

const router = Router();
const tag = "Reportes";
registerTag(tag, "Sprint 7 — Reportar un proyecto. La moderación es del Sprint 8 (`/admin/reports`).");

/** Severidad para la cola de moderación, según el motivo */
export const SEVERIDAD: Record<(typeof CATEGORIA_REPORTE)[number], "alta" | "media" | "baja"> = {
  propiedad_intelectual: "alta",
  contenido_enganoso: "media",
  spam: "baja",
  otro: "baja",
};

defineRoute(
  router,
  "/api",
  {
    method: "post",
    path: "/projects/:id/reports",
    tag,
    summary: "Reportar proyecto",
    description:
      "`reason`: `spam` | `contenido_enganoso` | `propiedad_intelectual` | `otro`; `description` obligatoria.\n\n" +
      "`201 { report }` · `409 ALREADY_REPORTED` · `409 CANNOT_REPORT_OWN` · `404 PROJECT_NOT_FOUND`.",
    params: z.object({ id: idParam }),
    body: z.object({
      reason: z.enum(CATEGORIA_REPORTE),
      description: z.string().trim().min(1, "Describe el problema").max(2000),
    }),
  },
  async ({ params, userId, body }) => {
    const p = await prisma.proyecto.findUnique({ where: { id: params.id }, select: { creadorId: true, estado: true } });
    if (!p || esOculto(p.estado)) {
      throw HttpError.notFound("El proyecto no existe o fue eliminado", "PROJECT_NOT_FOUND");
    }
    if (p.creadorId === userId) throw HttpError.conflict("No puedes reportar tu propio proyecto", "CANNOT_REPORT_OWN");

    const previo = await prisma.reporte.findUnique({
      where: { reportanteId_tipoEntidad_idEntidad: { reportanteId: userId, tipoEntidad: "Proyecto", idEntidad: params.id } },
      select: { id: true },
    });
    if (previo) throw HttpError.conflict("Ya reportaste este proyecto", "ALREADY_REPORTED");

    const r = await prisma.reporte.create({
      data: {
        reportanteId: userId,
        tipoEntidad: "Proyecto",
        idEntidad: params.id,
        categoria: body.reason,
        severidad: SEVERIDAD[body.reason],
        motivo: body.description,
      },
    });
    return {
      report: {
        id: r.id,
        projectId: r.idEntidad,
        reason: r.categoria,
        description: r.motivo,
        status: "abierto",
        createdAt: r.fechaReporte,
      },
    };
  },
);

export const reportesModule = { base: "/", router };
