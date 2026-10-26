import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError, z } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { HttpError } from "../utils/http-error.js";
import { env } from "../config/env.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
};

// Mensajes legibles para las restricciones propias del ER (prisma/sql/constraints.sql)
const MENSAJES_RESTRICCION: Record<string, string> = {
  perfil_disponibilidad_ck: "disponibilidadHorasSem debe estar entre 1 y 80",
  rol_proyecto_vacantes_totales_ck: "vacantesTotales debe ser mayor que 0",
  rol_proyecto_vacantes_disponibles_ck: "vacantesDisponibles debe estar entre 0 y vacantesTotales",
  miembro_equipo_fecha_baja_ck: "fechaBaja es obligatoria si el miembro no está Activo",
  miembro_equipo_motivo_baja_ck: "motivoBaja es obligatorio cuando el estado es Removido",
  miembro_equipo_activo_uq: "El usuario ya está activo en ese rol",
  adjunto_tamano_ck: "El adjunto no puede superar 10 MB",
  notificacion_email_intentos_ck: "intentos debe estar entre 0 y 3",
  usuario_email_key: "El email ya está registrado",
  postulacion_usuario_id_proyecto_id_key: "El usuario ya postuló a un rol de este proyecto",
  rol_proyecto_proyecto_id_nombre_key: "El proyecto ya tiene un rol con ese nombre",
  conversacion_proyecto_id_key: "El proyecto ya tiene una conversación",
  reporte_reportante_id_tipo_entidad_id_entidad_key: "Ya reportaste este elemento",
  entrega_proyecto_url_key: "Esa URL de entrega ya está registrada",
};

interface DbCause {
  code?: string; // código SQLSTATE de PostgreSQL
  constraint?: string;
  message?: string;
}

/** Extrae el error original de PostgreSQL de un error de Prisma (driver adapter) */
function dbCause(err: unknown): DbCause | undefined {
  if (!(err instanceof Error)) return undefined;
  const meta = (err as { meta?: { driverAdapterError?: { cause?: Record<string, unknown> } } }).meta;
  const cause = meta?.driverAdapterError?.cause;
  if (cause) {
    const constraint = cause.constraint as { index?: string } | undefined;
    const message = cause.originalMessage as string | undefined;
    return {
      code: cause.originalCode as string | undefined,
      constraint: constraint?.index ?? message?.match(/constraint "(\w+)"/)?.[1],
      message,
    };
  }
  const code = err.message.match(/Code: `(\w+)`/)?.[1];
  if (!code) return undefined;
  return {
    code,
    constraint: err.message.match(/constraint \\?"(\w+)\\?"/)?.[1],
    message: err.message.match(/Message: `([^`]+)`/)?.[1],
  };
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Validación (zod)
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Datos inválidos", details: z.flattenError(err) });
  }

  // Errores propios
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  // JSON mal formado en el body
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "El body no es un JSON válido" });
  }

  // No encontrado (update/delete sobre un id inexistente)
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    return res.status(404).json({ error: "Recurso no encontrado" });
  }

  // Restricciones de PostgreSQL
  const db = dbCause(err);
  if (db?.code) {
    const legible = db.constraint ? MENSAJES_RESTRICCION[db.constraint] : undefined;
    const details = { constraint: db.constraint };
    switch (db.code) {
      case "23505":
        return res.status(409).json({ error: legible ?? "Ya existe un registro con esos datos únicos", details });
      case "23503":
        return res.status(409).json({
          error: "Referencia a un registro inexistente, o el registro está en uso por otros datos",
          details,
        });
      case "23514": // CHECK o trigger fn_validar_postulacion
        return res.status(400).json({ error: legible ?? db.message ?? "Se viola una regla de negocio", details });
      case "23502":
        return res.status(400).json({ error: "Falta un campo obligatorio", details: { message: db.message } });
    }
  }

  console.error(err);
  return res.status(500).json({
    error: "Error interno del servidor",
    ...(env.NODE_ENV !== "production" && { details: err instanceof Error ? err.message : String(err) }),
  });
};
