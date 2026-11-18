import { Router } from "express";
import { z } from "zod";
import { defineRoute } from "../../lib/route.js";
import { registerTag } from "../../lib/openapi.js";
import { prisma } from "../../lib/prisma.js";
import { idParam } from "../../lib/schemas.js";
import { personaSelect, toPersona } from "../../lib/persona.js";
import { HttpError } from "../../utils/http-error.js";

const router = Router();
const base = "/api";
const tag = "Equipo";
registerTag(tag, "Sprint 6 — Equipo del proyecto: ver integrantes, salir del equipo y remover miembros.");

/** Da de baja una membresía activa y reabre la vacante del rol */
async function darDeBaja(miembroId: bigint, rolId: bigint, estado: "Retirado" | "Removido", motivo?: string) {
  await prisma.$transaction([
    prisma.miembroEquipo.update({
      where: { id: miembroId },
      data: { estado, fechaBaja: new Date(), motivoBaja: motivo ?? null },
    }),
    prisma.rolProyecto.update({ where: { id: rolId }, data: { vacantesDisponibles: { increment: 1 } } }),
  ]);
}

function membresiaActiva(projectId: bigint, userId: bigint) {
  return prisma.miembroEquipo.findFirst({
    where: { usuarioId: userId, estado: "Activo", rolProyecto: { proyectoId: projectId } },
    select: { id: true, rolProyectoId: true },
  });
}

defineRoute(
  router,
  base,
  {
    method: "get",
    path: "/projects/:id/team",
    tag,
    summary: "Equipo del proyecto",
    description:
      "`200 [{ userId, name, initials, photoUrl, role, roleId, isLeader, joinedAt }]`. " +
      "El creador aparece primero con `role: \"Líder del proyecto\"` e `isLeader: true`. `404 PROJECT_NOT_FOUND`.",
    params: z.object({ id: idParam }),
  },
  async ({ params, userId }) => {
    const p = await prisma.proyecto.findUnique({
      where: { id: params.id },
      select: {
        creadorId: true,
        estado: true,
        fechaCreacion: true,
        creador: { select: personaSelect },
        roles: {
          orderBy: { fechaCreacion: "asc" },
          select: {
            id: true,
            nombre: true,
            miembros: {
              where: { estado: "Activo" },
              orderBy: { fechaIngreso: "asc" },
              select: { fechaIngreso: true, usuario: { select: personaSelect } },
            },
          },
        },
      },
    });
    if (!p || (p.creadorId !== userId && (p.estado === "Borrador" || p.estado === "Cancelado"))) {
      throw HttpError.notFound("El proyecto no existe o fue eliminado", "PROJECT_NOT_FOUND");
    }
    const lider = toPersona(p.creador);
    return [
      {
        userId: lider.id,
        name: lider.name,
        initials: lider.initials,
        photoUrl: lider.photoUrl,
        role: "Líder del proyecto",
        roleId: null,
        isLeader: true,
        joinedAt: p.fechaCreacion,
      },
      ...p.roles.flatMap((r) =>
        r.miembros.map((m) => {
          const u = toPersona(m.usuario);
          return {
            userId: u.id,
            name: u.name,
            initials: u.initials,
            photoUrl: u.photoUrl,
            role: r.nombre,
            roleId: r.id,
            isLeader: false,
            joinedAt: m.fechaIngreso,
          };
        }),
      ),
    ];
  },
);

defineRoute(
  router,
  base,
  {
    method: "post",
    path: "/projects/:id/leave",
    tag,
    summary: "Salir del equipo",
    description:
      "Libera la vacante del rol y quita el acceso al chat. `204` · `409 OWNER_CANNOT_LEAVE` · `409 NOT_MEMBER`.",
    params: z.object({ id: idParam }),
  },
  async ({ params, userId }) => {
    const p = await prisma.proyecto.findUnique({ where: { id: params.id }, select: { creadorId: true } });
    if (!p) throw HttpError.notFound("El proyecto no existe", "PROJECT_NOT_FOUND");
    if (p.creadorId === userId) throw HttpError.conflict("El creador no puede salir de su propio proyecto", "OWNER_CANNOT_LEAVE");
    const m = await membresiaActiva(params.id, userId);
    if (!m) throw HttpError.conflict("No eres parte del equipo de este proyecto", "NOT_MEMBER");
    await darDeBaja(m.id, m.rolProyectoId, "Retirado");
  },
);

defineRoute(
  router,
  base,
  {
    method: "delete",
    path: "/projects/:id/members/:userId",
    tag,
    summary: "Remover miembro (creador)",
    description:
      "Reabre la vacante y quita el acceso al chat. Body: `{ reason }` (obligatorio). " +
      "`204` · `403 NOT_OWNER` · `404 MEMBER_NOT_FOUND`.",
    params: z.object({ id: idParam, userId: idParam }),
    body: z.object({ reason: z.string().trim().min(1, "Indica el motivo").max(500).meta({ example: "Inactividad" }) }),
  },
  async ({ params, userId, body }) => {
    const p = await prisma.proyecto.findUnique({ where: { id: params.id }, select: { creadorId: true } });
    if (!p) throw HttpError.notFound("El proyecto no existe", "PROJECT_NOT_FOUND");
    if (p.creadorId !== userId) throw HttpError.forbidden("Solo el creador puede remover miembros", "NOT_OWNER");
    const m = await membresiaActiva(params.id, params.userId);
    if (!m) throw HttpError.notFound("Esa persona no es miembro activo del proyecto", "MEMBER_NOT_FOUND");
    await darDeBaja(m.id, m.rolProyectoId, "Removido", body.reason);
  },
);

export const equipoModule = { base: "/", router };
