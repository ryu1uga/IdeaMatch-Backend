import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError, z } from "zod";
import multer from "multer";
import { Prisma } from "../generated/prisma/client.js";
import { HttpError } from "../utils/http-error.js";
import { env } from "../config/env.js";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, "ROUTE_NOT_FOUND"));
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
    return res.status(400).json({ code: "VALIDATION", message: "Datos inválidos", details: z.flattenError(err) });
  }

  // Errores propios
  if (err instanceof HttpError) {
    return res.status(err.status).json({ code: err.code, message: err.message, details: err.details });
  }

  // Subida de archivos (tamaño excedido, campo inesperado, etc.)
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "El archivo supera el tamaño máximo permitido"
        : `Archivo inválido: envía un solo archivo en el campo 'file' (${err.code})`;
    return res.status(400).json({ code: "INVALID_FILE", message });
  }

  // JSON mal formado en el body
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ code: "INVALID_JSON", message: "El body no es un JSON válido" });
  }

  // Errores HTTP de Express y sus middlewares (body demasiado grande, archivo estático, etc.)
  const httpStatus = (err as { status?: unknown }).status;
  if (typeof httpStatus === "number" && httpStatus >= 400 && httpStatus < 500) {
    const code = httpStatus === 404 ? "NOT_FOUND" : httpStatus === 413 ? "PAYLOAD_TOO_LARGE" : "BAD_REQUEST";
    const message = httpStatus === 404 ? "Recurso no encontrado" : httpStatus === 413 ? "El contenido es demasiado grande" : "Solicitud inválida";
    return res.status(httpStatus).json({ code, message });
  }

  // No encontrado (update/delete sobre un id inexistente)
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
    return res.status(404).json({ code: "NOT_FOUND", message: "Recurso no encontrado" });
  }

  // Restricciones de PostgreSQL
  const db = dbCause(err);
  if (db?.code) {
    const legible = db.constraint ? MENSAJES_RESTRICCION[db.constraint] : undefined;
    const details = { constraint: db.constraint };
    switch (db.code) {
      case "23505":
        return res
          .status(409)
          .json({ code: "CONFLICT", message: legible ?? "Ya existe un registro con esos datos únicos", details });
      case "23503":
        return res.status(409).json({
          code: "CONFLICT",
          message: "Referencia a un registro inexistente, o el registro está en uso por otros datos",
          details,
        });
      case "23514": // CHECK o trigger fn_validar_postulacion
        return res
          .status(400)
          .json({ code: "VALIDATION", message: legible ?? db.message ?? "Se viola una regla de negocio", details });
      case "23502":
        return res
          .status(400)
          .json({ code: "VALIDATION", message: "Falta un campo obligatorio", details: { message: db.message } });
    }
  }

  console.error(err);
  return res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "Error interno del servidor",
    ...(env.NODE_ENV !== "production" && { details: err instanceof Error ? err.message : String(err) }),
  });
};
