import { Router } from "express";
import { z } from "zod";
import { defineRoute } from "../../lib/route.js";
import { registerTag } from "../../lib/openapi.js";
import { idParam, idQuery, searchQuery } from "../../lib/schemas.js";
import { MB, requireFile } from "../../lib/upload.js";
import { conversacionesService as svc } from "./conversaciones.service.js";

const router = Router();
const base = "/api";
const tag = "Mensajería";
registerTag(
  tag,
  "Sprint 6 — Chat grupal por proyecto (uno por proyecto publicado). Solo el creador y los miembros activos " +
    "acceden (`403 NOT_MEMBER`).\n\n" +
    "**Tiempo real:** conéctate a `ws(s)://<host>/ws?token=<jwt>`. Eventos `{ type, data }`: " +
    "`message:new` `{ conversationId, message }` · `message:read` `{ conversationId, userId, readAt }`. " +
    "Como respaldo, `GET /conversations/:id/messages?after=<idDelÚltimo>` devuelve solo los nuevos.",
);

const convParams = z.object({ id: idParam });

defineRoute(
  router,
  base,
  {
    method: "get",
    path: "/conversations",
    tag,
    summary: "Mis conversaciones",
    description:
      "`200 [{ id, project { id, name, initials, status, coverColor }, lastMessage { text, authorName, sentAt } | null, unreadCount }]`, " +
      "con actividad más reciente primero. `q` filtra por nombre del proyecto.",
    query: z.object({ q: searchQuery }),
  },
  ({ userId, query }) => svc.list(userId, query.q),
);

defineRoute(
  router,
  base,
  {
    method: "get",
    path: "/conversations/:id",
    tag,
    summary: "Detalle de la conversación",
    description: "`200 { id, project, projectStatus, membersCount, members[] }` · `403 NOT_MEMBER` · `404 CONVERSATION_NOT_FOUND`.",
    params: convParams,
  },
  ({ params, userId }) => svc.get(params.id, userId),
);

defineRoute(
  router,
  base,
  {
    method: "get",
    path: "/conversations/:id/messages",
    tag,
    summary: "Mensajes",
    description:
      "`200 [{ id, author { id, name, initials, photoUrl }, text, sentAt, readByOthers, attachments[] }]` en orden cronológico.\n\n" +
      "- Sin cursor: los últimos `limit`.\n- `before=<id>`: los anteriores a ese mensaje (cargar historial).\n" +
      "- `after=<id>`: los posteriores (polling).",
    params: convParams,
    query: z.object({
      before: idQuery,
      after: idQuery,
      limit: z.coerce.number().int().min(1).max(100).default(30),
    }),
  },
  ({ params, userId, query }) => svc.messages(params.id, userId, query),
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/conversations/:id/messages",
    tag,
    summary: "Enviar mensaje",
    description:
      "JSON `{ text }` o multipart con `file` (PDF o PNG ≤ 10 MB) y `text` opcional. `201 { message }`.\n\n" +
      "Errores: `400 EMPTY_MESSAGE` · `400 INVALID_FILE` · `403 NOT_MEMBER` · `409 PROJECT_CLOSED` (chat de solo lectura).",
    params: convParams,
    body: z.object({ text: z.string().max(2000).optional() }),
    upload: { field: "file", maxBytes: 10 * MB, description: "PDF o PNG ≤ 10 MB" },
  },
  ({ params, userId, body, req }) => {
    const file = req.file
      ? { ...requireFile(req.file, ["application/pdf", "image/png"], "El adjunto debe ser PDF o PNG de hasta 10 MB"), name: req.file.originalname }
      : undefined;
    return svc.send(params.id, userId, { text: body.text, file, baseUrl: `${req.protocol}://${req.get("host")}` });
  },
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/conversations/:id/read",
    tag,
    summary: "Marcar como leída",
    description: "`204`. Pone en 0 los no leídos y notifica `message:read` a los demás.",
    params: convParams,
  },
  async ({ params, userId }) => {
    await svc.markRead(params.id, userId);
  },
);

export const conversacionesModule = { base: "/", router };
