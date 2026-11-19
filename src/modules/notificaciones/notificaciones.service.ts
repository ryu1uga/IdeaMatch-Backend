import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { emitToUsers } from "../../lib/realtime.js";
import { HttpError } from "../../utils/http-error.js";
import { notificationTypeFromDb, type TipoNotificacionDb } from "../../domain/notificacion.js";

type EntidadRef = "Proyecto" | "Postulacion" | "Mensaje" | "Reporte" | "Insignia";

export interface NuevaNotificacion {
  tipo: TipoNotificacionDb;
  mensaje: string;
  ref?: { tipo: EntidadRef; id: bigint };
  payload?: Record<string, unknown>;
}

const notificacionSelect = {
  id: true,
  tipo: true,
  mensaje: true,
  datos: true,
  leida: true,
  fechaCreacion: true,
  entidadRefTipo: true,
  entidadRefId: true,
} as const satisfies Prisma.NotificacionSelect;

type NotificacionRow = Prisma.NotificacionGetPayload<{ select: typeof notificacionSelect }>;

function toNotificationDto(n: NotificacionRow) {
  return {
    id: n.id,
    type: notificationTypeFromDb(n.tipo),
    message: n.mensaje,
    payload: n.datos ?? {},
    read: n.leida,
    createdAt: n.fechaCreacion,
  };
}

/** Los BigInt no son JSON válido: se guardan como string en el payload */
const jsonSeguro = (o: Record<string, unknown>) =>
  JSON.parse(JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? v.toString() : v))) as Prisma.InputJsonValue;

/**
 * Crea la notificación para cada destinatario y la envía por WebSocket (`notification:new`).
 * Es "best effort": si falla, se registra en consola y no se revierte la acción que la originó.
 */
export async function notificar(destinatarios: Iterable<bigint>, n: NuevaNotificacion) {
  const ids = [...new Set([...destinatarios].map(String))].map((x) => BigInt(x));
  try {
    for (const usuarioId of ids) {
      const row = await prisma.notificacion.create({
        data: {
          usuarioId,
          tipo: n.tipo,
          mensaje: n.mensaje.slice(0, 500),
          entidadRefTipo: n.ref?.tipo ?? null,
          entidadRefId: n.ref?.id ?? null,
          datos: n.payload ? jsonSeguro(n.payload) : undefined,
        },
        select: notificacionSelect,
      });
      emitToUsers([usuarioId], "notification:new", { notification: toNotificationDto(row) });
    }
  } catch (err) {
    console.error("[notificaciones] no se pudo crear la notificación", err);
  }
}

/** Mensajes no leídos en todas las conversaciones del usuario (una sola consulta) */
async function mensajesNoLeidos(userId: bigint) {
  const [{ total }] = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*)::bigint AS total
    FROM "mensaje" m
    JOIN "conversacion" c ON c."id" = m."conversacion_id"
    JOIN "proyecto" p ON p."id" = c."proyecto_id"
    LEFT JOIN "conversacion_lectura" l ON l."conversacion_id" = c."id" AND l."usuario_id" = ${userId}
    WHERE m."autor_id" <> ${userId}
      AND p."estado" <> 'Borrador'
      AND (l."ultima_lectura" IS NULL OR m."fecha_envio" > l."ultima_lectura")
      AND (
        p."creador_id" = ${userId}
        OR EXISTS (
          SELECT 1 FROM "miembro_equipo" me
          JOIN "rol_proyecto" r ON r."id" = me."rol_proyecto_id"
          WHERE r."proyecto_id" = p."id" AND me."usuario_id" = ${userId} AND me."estado" = 'Activo'
        )
      )`;
  return Number(total);
}

export const notificacionesService = {
  async list(userId: bigint, f: { unreadOnly: boolean; page: number; limit: number }) {
    const where: Prisma.NotificacionWhereInput = { usuarioId: userId, ...(f.unreadOnly && { leida: false }) };
    const [unreadCount, total, rows] = await Promise.all([
      prisma.notificacion.count({ where: { usuarioId: userId, leida: false } }),
      prisma.notificacion.count({ where }),
      prisma.notificacion.findMany({
        where,
        orderBy: [{ fechaCreacion: "desc" }, { id: "desc" }],
        skip: (f.page - 1) * f.limit,
        take: f.limit,
        select: notificacionSelect,
      }),
    ]);
    return { unreadCount, total, page: f.page, limit: f.limit, items: rows.map(toNotificationDto) };
  },

  async markRead(id: bigint, userId: bigint) {
    const r = await prisma.notificacion.updateMany({
      where: { id, usuarioId: userId },
      data: { leida: true, fechaLectura: new Date() },
    });
    if (!r.count) throw HttpError.notFound("La notificación no existe", "NOTIFICATION_NOT_FOUND");
  },

  async markAllRead(userId: bigint) {
    await prisma.notificacion.updateMany({
      where: { usuarioId: userId, leida: false },
      data: { leida: true, fechaLectura: new Date() },
    });
  },

  async counters(userId: bigint) {
    const [unreadNotifications, unreadMessages] = await Promise.all([
      prisma.notificacion.count({ where: { usuarioId: userId, leida: false } }),
      mensajesNoLeidos(userId),
    ]);
    return { unreadNotifications, unreadMessages };
  },
};
