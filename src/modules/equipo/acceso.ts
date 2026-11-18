import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/http-error.js";

/** IDs del creador y de los miembros activos del proyecto */
export async function participantes(projectId: bigint) {
  const p = await prisma.proyecto.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      creadorId: true,
      roles: { select: { miembros: { where: { estado: "Activo" }, select: { usuarioId: true } } } },
    },
  });
  const ids = new Set([String(p.creadorId)]);
  for (const r of p.roles) for (const m of r.miembros) ids.add(String(m.usuarioId));
  return [...ids].map((x) => BigInt(x));
}

/** ¿Es creador o miembro activo? */
export async function esParticipante(projectId: bigint, userId: bigint) {
  const n = await prisma.proyecto.count({
    where: {
      id: projectId,
      OR: [
        { creadorId: userId },
        { roles: { some: { miembros: { some: { usuarioId: userId, estado: "Activo" } } } } },
      ],
    },
  });
  return n > 0;
}

/** Conversación a la que el usuario tiene acceso: 404 si no existe, 403 NOT_MEMBER si no participa */
export async function conversacionParticipante(conversationId: bigint, userId: bigint) {
  const c = await prisma.conversacion.findUnique({
    where: { id: conversationId },
    select: { id: true, proyectoId: true, proyecto: { select: { estado: true } } },
  });
  if (!c) throw HttpError.notFound("La conversación no existe", "CONVERSATION_NOT_FOUND");
  if (!(await esParticipante(c.proyectoId, userId))) {
    throw HttpError.forbidden("Solo el creador y los miembros del equipo pueden acceder al chat", "NOT_MEMBER");
  }
  return c;
}
