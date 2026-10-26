import { z } from "zod";
import { crud } from "../../lib/crud.js";
import { atLeastOne, idQuery, idRef } from "../../lib/schemas.js";
import { ESTADO_REPORTE, TIPO_ENTIDAD_REPORTE } from "../../domain/enums.js";

export const reportesModule = crud({
  model: "reporte",
  base: "/reportes",
  tag: "Reportes",
  tagDescription: "Reportes de proyectos, mensajes o usuarios. Un usuario no puede reportar dos veces lo mismo.",
  singular: "reporte",
  list: {
    filters: z.object({
      estado: z.enum(ESTADO_REPORTE).optional(),
      tipoEntidad: z.enum(TIPO_ENTIDAD_REPORTE).optional(),
      reportanteId: idQuery,
    }),
    orderBy: { fechaReporte: "desc" },
  },
  include: {
    reportante: { select: { id: true, email: true } },
    admin: { select: { id: true, email: true } },
  },
  create: {
    description: "El reportante es el usuario autenticado.",
    body: z.object({
      tipoEntidad: z.enum(TIPO_ENTIDAD_REPORTE),
      idEntidad: idRef,
      motivo: z.string().trim().min(1).max(2000),
    }),
    data: (b, ctx) => ({ ...b, reportanteId: ctx.userId }),
  },
  update: {
    description:
      "Al cambiar el estado, el usuario autenticado queda como admin que lo gestionó. En Resuelto/Desestimado se registra fechaResolucion.",
    body: atLeastOne(
      z.object({ estado: z.enum(ESTADO_REPORTE).optional(), resolucion: z.string().max(2000).nullable().optional() }),
    ),
    data: (b, ctx) => ({
      ...b,
      adminId: b.estado !== undefined ? ctx.userId : undefined,
      fechaResolucion: b.estado === "Resuelto" || b.estado === "Desestimado" ? new Date() : undefined,
    }),
  },
});
