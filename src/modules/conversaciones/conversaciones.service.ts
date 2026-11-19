import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { emitToUsers } from "../../lib/realtime.js";
import { storage } from "../../lib/storage.js";
import { inicialesProyecto, nombreCompleto, personaSelect, toPersona } from "../../lib/persona.js";
import { ESTADOS_FINALES, portada, statusFromDb, type EstadoProyectoDb } from "../../domain/proyecto.js";
import { HttpError } from "../../utils/http-error.js";
import { conversacionParticipante, participantes } from "../equipo/acceso.js";

const mensajeSelect = {
  id: true,
  autorId: true,
  contenido: true,
  fechaEnvio: true,
  autor: { select: personaSelect },
  adjuntos: { select: { id: true, url: true, nombre: true, tipoMime: true, tamanoBytes: true } },
} as const satisfies Prisma.MensajeSelect;

type MensajeRow = Prisma.MensajeGetPayload<{ select: typeof mensajeSelect }>;

/** Lecturas de la conversación: usuario -> última lectura */
async function lecturas(conversacionId: bigint) {
  const rows = await prisma.conversacionLectura.findMany({ where: { conversacionId } });
  return new Map(rows.map((r) => [String(r.usuarioId), r.ultimaLectura]));
}

function toMessageDto(m: MensajeRow, leido: Map<string, Date>) {
  return {
    id: m.id,
    author: toPersona(m.autor),
    text: m.contenido || null,
    sentAt: m.fechaEnvio,
    // true si algún otro participante abrió la conversación después de este mensaje
    readByOthers: [...leido].some(([uid, at]) => uid !== String(m.autorId) && at >= m.fechaEnvio),
    attachments: m.adjuntos.map((a) => ({ id: a.id, url: a.url, name: a.nombre, mimeType: a.tipoMime, size: a.tamanoBytes })),
  };
}

export const conversacionesService = {
  async list(userId: bigint, q?: string) {
    const rows = await prisma.conversacion.findMany({
      where: {
        proyecto: {
          estado: { not: "Borrador" },
          OR: [
            { creadorId: userId },
            { roles: { some: { miembros: { some: { usuarioId: userId, estado: "Activo" } } } } },
          ],
          ...(q && { titulo: { contains: q, mode: "insensitive" } }),
        },
      },
      select: {
        id: true,
        fechaCreacion: true,
        proyecto: { select: { id: true, titulo: true, estado: true, categoriaId: true } },
        mensajes: {
          orderBy: { id: "desc" },
          take: 1,
          select: { contenido: true, fechaEnvio: true, autor: { select: { nombres: true, apellidos: true } }, _count: { select: { adjuntos: true } } },
        },
        lecturas: { where: { usuarioId: userId }, select: { ultimaLectura: true } },
      },
    });

    const items = await Promise.all(
      rows.map(async (c) => {
        const desde = c.lecturas[0]?.ultimaLectura;
        const unreadCount = await prisma.mensaje.count({
          where: { conversacionId: c.id, autorId: { not: userId }, ...(desde && { fechaEnvio: { gt: desde } }) },
        });
        const last = c.mensajes[0];
        return {
          id: c.id,
          project: {
            id: c.proyecto.id,
            name: c.proyecto.titulo,
            initials: inicialesProyecto(c.proyecto.titulo),
            status: statusFromDb(c.proyecto.estado),
            coverColor: portada(c.proyecto.id, c.proyecto.categoriaId).coverColor,
          },
          lastMessage: last
            ? {
                text: last.contenido || (last._count.adjuntos ? "Archivo adjunto" : ""),
                authorName: nombreCompleto(last.autor),
                sentAt: last.fechaEnvio,
              }
            : null,
          unreadCount,
          _orden: (last?.fechaEnvio ?? c.fechaCreacion).getTime(),
        };
      }),
    );
    // Más reciente primero
    return items.sort((a, b) => b._orden - a._orden).map(({ _orden, ...rest }) => rest);
  },

  async get(conversationId: bigint, userId: bigint) {
    const c = await conversacionParticipante(conversationId, userId);
    const p = await prisma.proyecto.findUniqueOrThrow({
      where: { id: c.proyectoId },
      select: {
        id: true,
        titulo: true,
        estado: true,
        categoriaId: true,
        creador: { select: personaSelect },
        roles: {
          select: {
            nombre: true,
            miembros: { where: { estado: "Activo" }, select: { usuario: { select: personaSelect } } },
          },
        },
      },
    });
    const members = [
      { ...toPersona(p.creador), role: "Líder del proyecto", isLeader: true },
      ...p.roles.flatMap((r) => r.miembros.map((m) => ({ ...toPersona(m.usuario), role: r.nombre, isLeader: false }))),
    ];
    return {
      id: c.id,
      project: {
        id: p.id,
        name: p.titulo,
        initials: inicialesProyecto(p.titulo),
        coverColor: portada(p.id, p.categoriaId).coverColor,
      },
      projectStatus: statusFromDb(p.estado),
      membersCount: members.length,
      members,
    };
  },

  async messages(conversationId: bigint, userId: bigint, f: { before?: bigint; after?: bigint; limit: number }) {
    await conversacionParticipante(conversationId, userId);
    const where: Prisma.MensajeWhereInput = {
      conversacionId: conversationId,
      ...(f.before && { id: { lt: f.before } }),
      ...(f.after && { id: { gt: f.after } }),
    };
    // after (polling): los siguientes en orden; si no, los últimos `limit` (o anteriores a `before`)
    const rows = await prisma.mensaje.findMany({
      where,
      orderBy: { id: f.after ? "asc" : "desc" },
      take: f.limit,
      select: mensajeSelect,
    });
    if (!f.after) rows.reverse();
    const leido = await lecturas(conversationId);
    return rows.map((m) => toMessageDto(m, leido));
  },

  async send(
    conversationId: bigint,
    userId: bigint,
    input: { text?: string; file?: { buffer: Buffer; mime: string; size: number; name: string }; baseUrl: string },
  ) {
    const c = await conversacionParticipante(conversationId, userId);
    if (ESTADOS_FINALES.includes(c.proyecto.estado as EstadoProyectoDb)) {
      throw HttpError.conflict("El proyecto está cerrado: el chat es de solo lectura", "PROJECT_CLOSED");
    }
    const text = input.text?.trim() ?? "";
    if (!text && !input.file) throw HttpError.badRequest("Escribe un mensaje o adjunta un archivo", "EMPTY_MESSAGE");

    const stored = input.file
      ? await storage.save({
          buffer: input.file.buffer,
          mime: input.file.mime,
          folder: "attachments",
          kind: input.file.mime === "application/pdf" ? "raw" : "image",
          baseUrl: input.baseUrl,
        })
      : undefined;

    const m = await prisma.mensaje.create({
      data: {
        conversacionId: conversationId,
        autorId: userId,
        contenido: text,
        ...(stored &&
          input.file && {
            adjuntos: {
              create: {
                url: stored.url,
                nombre: input.file.name.slice(0, 255),
                tipoMime: input.file.mime,
                tamanoBytes: input.file.size,
              },
            },
          }),
      },
      select: mensajeSelect,
    });
    // Quien envía ya leyó la conversación hasta su propio mensaje
    await prisma.conversacionLectura.upsert({
      where: { conversacionId_usuarioId: { conversacionId: conversationId, usuarioId: userId } },
      update: { ultimaLectura: m.fechaEnvio },
      create: { conversacionId: conversationId, usuarioId: userId, ultimaLectura: m.fechaEnvio },
    });
    const message = toMessageDto(m, await lecturas(conversationId));
    emitToUsers(await participantes(c.proyectoId), "message:new", { conversationId, message });
    return { message };
  },

  async markRead(conversationId: bigint, userId: bigint) {
    const c = await conversacionParticipante(conversationId, userId);
    const readAt = new Date();
    await prisma.conversacionLectura.upsert({
      where: { conversacionId_usuarioId: { conversacionId: conversationId, usuarioId: userId } },
      update: { ultimaLectura: readAt },
      create: { conversacionId: conversationId, usuarioId: userId, ultimaLectura: readAt },
    });
    const otros = (await participantes(c.proyectoId)).filter((id) => id !== userId);
    emitToUsers(otros, "message:read", { conversationId, userId, readAt });
  },
};
