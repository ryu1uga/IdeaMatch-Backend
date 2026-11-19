import { Router } from "express";
import { z } from "zod";
import { defineRoute } from "../../lib/route.js";
import { registerTag } from "../../lib/openapi.js";
import { boolQuery, idParam } from "../../lib/schemas.js";
import { NOTIFICATION_TYPES } from "../../domain/notificacion.js";
import { notificacionesService as svc } from "./notificaciones.service.js";

const router = Router();
const base = "/api";
const tag = "Notificaciones";
registerTag(
  tag,
  "Sprint 7 — Notificaciones in-app. También llegan en vivo por WebSocket como `notification:new` `{ notification }`.\n\n" +
    `Tipos (\`type\`): ${Object.values(NOTIFICATION_TYPES).map((t) => `\`${t}\``).join(", ")}.`,
);

defineRoute(
  router,
  base,
  {
    method: "get",
    path: "/notifications",
    tag,
    summary: "Mis notificaciones",
    description:
      "`200 { unreadCount, total, page, limit, items: [{ id, type, message, payload, read, createdAt }] }`, más recientes primero. " +
      "`payload` trae los IDs y nombres para navegar (p. ej. `projectId`, `applicationId`, `roleName`).",
    query: z.object({
      unreadOnly: boolQuery,
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
  },
  ({ userId, query }) => svc.list(userId, { ...query, unreadOnly: query.unreadOnly ?? false }),
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/notifications/read-all",
    tag,
    summary: "Marcar todas como leídas",
    description: "`204`",
  },
  async ({ userId }) => {
    await svc.markAllRead(userId);
  },
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/notifications/:id/read",
    tag,
    summary: "Marcar como leída",
    description: "`204` · `404 NOTIFICATION_NOT_FOUND` (no existe o no es tuya).",
    params: z.object({ id: idParam }),
  },
  async ({ userId, params }) => {
    await svc.markRead(params.id, userId);
  },
);

defineRoute(
  router,
  base,
  {
    method: "get",
    path: "/me/counters",
    tag,
    summary: "Contadores de la barra lateral",
    description: "`200 { unreadNotifications, unreadMessages }` (campana y número junto a 'Mensajes').",
  },
  ({ userId }) => svc.counters(userId),
);

export const notificacionesModule = { base: "/", router };
