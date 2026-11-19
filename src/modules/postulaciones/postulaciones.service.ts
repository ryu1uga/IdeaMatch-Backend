import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import {
  applicationStatusFromDb,
  applicationStatusToDb,
  portada,
  statusFromDb,
  type ApplicationStatus,
} from "../../domain/proyecto.js";
import { notificar } from "../notificaciones/notificaciones.service.js";

/** Una postulación pendiente se marca como nueva durante estas horas */
const HORAS_NUEVA = 72;
/** Estados del proyecto en los que el creador puede aceptar postulaciones */
const ESTADOS_ACEPTAN = ["Abierto", "En_Curso"];

const iniciales = (u: { nombres: string; apellidos: string }) =>
  `${u.nombres.trim().charAt(0)}${u.apellidos.trim().charAt(0)}`.toUpperCase();

const applicationSelect = {
  id: true,
  proyectoId: true,
  rolProyectoId: true,
  estado: true,
  notaPresentacion: true,
  fechaPostulacion: true,
  fechaResolucion: true,
} as const;

type ApplicationRow = Prisma.PostulacionGetPayload<{ select: typeof applicationSelect }>;

function toApplicationDto(a: ApplicationRow) {
  return {
    id: a.id,
    projectId: a.proyectoId,
    roleId: a.rolProyectoId,
    status: applicationStatusFromDb(a.estado),
    note: a.notaPresentacion,
    createdAt: a.fechaPostulacion,
    resolvedAt: a.fechaResolucion,
  };
}

/** Postulación que el creador del proyecto va a resolver */
async function postulacionDelCreador(id: bigint, userId: bigint) {
  const a = await prisma.postulacion.findUnique({
    where: { id },
    select: {
      ...applicationSelect,
      usuarioId: true,
      rolProyecto: { select: { nombre: true } },
      proyecto: { select: { creadorId: true, estado: true, titulo: true } },
    },
  });
  if (!a) throw HttpError.notFound("La postulación no existe", "APPLICATION_NOT_FOUND");
  if (a.proyecto.creadorId !== userId) {
    throw HttpError.forbidden("Solo el creador del proyecto puede resolver la postulación", "NOT_OWNER");
  }
  if (a.estado !== "Pendiente") throw HttpError.conflict("La postulación ya fue resuelta", "NOT_PENDING");
  return a;
}

export const postulacionesService = {
  async apply(projectId: bigint, roleId: bigint, userId: bigint, note: string | null) {
    const rol = await prisma.rolProyecto.findFirst({
      where: { id: roleId, proyectoId: projectId },
      select: { nombre: true, vacantesDisponibles: true, proyecto: { select: { estado: true, creadorId: true, titulo: true } } },
    });
    if (!rol) {
      const existe = await prisma.proyecto.count({ where: { id: projectId, estado: { notIn: ["Borrador", "Cancelado"] } } });
      throw existe
        ? HttpError.notFound("El rol no existe en este proyecto", "ROLE_NOT_FOUND")
        : HttpError.notFound("El proyecto no existe o fue eliminado", "PROJECT_NOT_FOUND");
    }
    if (rol.proyecto.estado === "Borrador" || rol.proyecto.estado === "Cancelado") {
      throw HttpError.notFound("El proyecto no existe o fue eliminado", "PROJECT_NOT_FOUND");
    }
    if (rol.proyecto.creadorId === userId) {
      throw HttpError.conflict("No puedes postular a tu propio proyecto", "OWNER_CANNOT_APPLY");
    }
    if (rol.proyecto.estado !== "Abierto") {
      throw HttpError.conflict("El proyecto no está recibiendo postulaciones", "PROJECT_NOT_OPEN");
    }
    const miembro = await prisma.miembroEquipo.count({
      where: { usuarioId: userId, estado: "Activo", rolProyecto: { proyectoId: projectId } },
    });
    if (miembro) throw HttpError.conflict("Ya eres parte del equipo de este proyecto", "ALREADY_MEMBER");

    // Una postulación por proyecto. Si el colaborador canceló la suya, puede volver a postular.
    const previa = await prisma.postulacion.findUnique({
      where: { usuarioId_proyectoId: { usuarioId: userId, proyectoId: projectId } },
      select: { id: true, estado: true },
    });
    if (previa && previa.estado !== "Cancelada_Colaborador") {
      throw HttpError.conflict("Ya postulaste a un rol de este proyecto", "ALREADY_APPLIED");
    }
    if (rol.vacantesDisponibles <= 0) throw HttpError.conflict("El rol ya no tiene vacantes", "ROLE_FULL");

    const data = {
      rolProyectoId: roleId,
      estado: "Pendiente",
      notaPresentacion: note,
      fechaPostulacion: new Date(),
      fechaResolucion: null,
    };
    const a = previa
      ? await prisma.postulacion.update({ where: { id: previa.id }, data, select: applicationSelect })
      : await prisma.postulacion.create({
          data: { ...data, usuarioId: userId, proyectoId: projectId },
          select: applicationSelect,
        });

    const yo = await prisma.usuario.findUniqueOrThrow({ where: { id: userId }, select: { nombres: true, apellidos: true } });
    const nombre = `${yo.nombres} ${yo.apellidos}`.trim();
    await notificar([rol.proyecto.creadorId], {
      tipo: "Nueva_Postulacion",
      mensaje: `${nombre} postuló al rol ${rol.nombre} en ${rol.proyecto.titulo}`,
      ref: { tipo: "Postulacion", id: a.id },
      payload: {
        projectId,
        projectName: rol.proyecto.titulo,
        roleId,
        roleName: rol.nombre,
        applicationId: a.id,
        applicantId: userId,
        applicantName: nombre,
      },
    });
    return { application: toApplicationDto(a) };
  },

  async listMine(userId: bigint, f: { status?: ApplicationStatus; page: number; limit: number }) {
    const where: Prisma.PostulacionWhereInput = {
      usuarioId: userId,
      ...(f.status && { estado: applicationStatusToDb(f.status) }),
    };
    const [porEstado, total, rows] = await Promise.all([
      prisma.postulacion.groupBy({ by: ["estado"], where: { usuarioId: userId }, _count: { _all: true } }),
      prisma.postulacion.count({ where }),
      prisma.postulacion.findMany({
        where,
        orderBy: { fechaPostulacion: "desc" },
        skip: (f.page - 1) * f.limit,
        take: f.limit,
        select: {
          ...applicationSelect,
          rolProyecto: { select: { id: true, nombre: true } },
          proyecto: {
            select: { id: true, titulo: true, estado: true, categoriaId: true, categoria: { select: { id: true, nombre: true } } },
          },
        },
      }),
    ]);
    const cuenta = (e: string) => porEstado.find((x) => x.estado === e)?._count._all ?? 0;

    return {
      // sent: todas · inReview: pendientes · accepted: aceptadas · finished: rechazadas o canceladas
      summary: {
        sent: porEstado.reduce((a, x) => a + x._count._all, 0),
        inReview: cuenta("Pendiente"),
        accepted: cuenta("Aceptada"),
        finished: cuenta("Rechazada") + cuenta("Cancelada_Colaborador"),
      },
      total,
      page: f.page,
      limit: f.limit,
      items: rows.map((a) => ({
        ...toApplicationDto(a),
        project: {
          id: a.proyecto.id,
          name: a.proyecto.titulo,
          status: statusFromDb(a.proyecto.estado),
          category: a.proyecto.categoria ? { id: a.proyecto.categoria.id, name: a.proyecto.categoria.nombre } : null,
          coverColor: portada(a.proyecto.id, a.proyecto.categoriaId).coverColor,
        },
        role: { id: a.rolProyecto.id, name: a.rolProyecto.nombre },
      })),
    };
  },

  async cancel(id: bigint, userId: bigint) {
    const a = await prisma.postulacion.findUnique({ where: { id }, select: { usuarioId: true, estado: true } });
    if (!a) throw HttpError.notFound("La postulación no existe", "APPLICATION_NOT_FOUND");
    if (a.usuarioId !== userId) throw HttpError.forbidden("Solo quien postuló puede cancelarla", "NOT_APPLICANT");
    if (a.estado !== "Pendiente") throw HttpError.conflict("La postulación ya fue procesada", "ALREADY_PROCESSED");
    const updated = await prisma.postulacion.update({
      where: { id },
      data: { estado: "Cancelada_Colaborador", fechaResolucion: new Date() },
      select: applicationSelect,
    });
    return { application: toApplicationDto(updated) };
  },

  async listForProject(
    projectId: bigint,
    userId: bigint,
    f: { roleId?: bigint; status: ApplicationStatus; q?: string; sort: "match" | "recent"; page: number; limit: number },
  ) {
    const p = await prisma.proyecto.findUnique({
      where: { id: projectId },
      select: {
        creadorId: true,
        roles: {
          orderBy: { fechaCreacion: "asc" },
          select: { id: true, nombre: true, vacantesDisponibles: true, habilidades: { select: { habilidadId: true } } },
        },
      },
    });
    if (!p) throw HttpError.notFound("El proyecto no existe", "PROJECT_NOT_FOUND");
    if (p.creadorId !== userId) throw HttpError.forbidden("Solo el creador puede ver las postulaciones", "NOT_OWNER");

    const estado = applicationStatusToDb(f.status);
    const whereBase: Prisma.PostulacionWhereInput = {
      proyectoId: projectId,
      estado,
      ...(f.q && {
        usuario: {
          OR: [
            { nombres: { contains: f.q, mode: "insensitive" } },
            { apellidos: { contains: f.q, mode: "insensitive" } },
            { perfil: { titular: { contains: f.q, mode: "insensitive" } } },
          ],
        },
      }),
    };

    const [porRol, rows] = await Promise.all([
      prisma.postulacion.groupBy({ by: ["rolProyectoId"], where: whereBase, _count: { _all: true } }),
      prisma.postulacion.findMany({
        where: { ...whereBase, ...(f.roleId && { rolProyectoId: f.roleId }) },
        select: {
          ...applicationSelect,
          usuario: {
            select: {
              id: true,
              nombres: true,
              apellidos: true,
              perfil: {
                select: {
                  titular: true,
                  ubicacion: true,
                  fotoUrl: true,
                  disponibilidadHorasSem: true,
                  linkPortafolio: true,
                  linkLinkedin: true,
                  linkGithub: true,
                },
              },
              habilidades: { select: { habilidad: { select: { id: true, nombre: true } } } },
              _count: { select: { proyectosCreados: true, membresias: { where: { estado: { in: ["Activo", "Retirado"] } } } } },
            },
          },
        },
      }),
    ]);

    const rolesPorId = new Map(p.roles.map((r) => [String(r.id), r]));
    const ahora = Date.now();
    const cards = rows.map((a) => {
      const rol = rolesPorId.get(String(a.rolProyectoId))!;
      const pedidas = new Set(rol.habilidades.map((h) => String(h.habilidadId)));
      const tiene = a.usuario.habilidades.filter((h) => pedidas.has(String(h.habilidad.id))).length;
      const pf = a.usuario.perfil;
      return {
        id: a.id,
        roleId: a.rolProyectoId,
        role: rol.nombre,
        status: applicationStatusFromDb(a.estado),
        note: a.notaPresentacion,
        createdAt: a.fechaPostulacion,
        isNew: a.estado === "Pendiente" && ahora - a.fechaPostulacion.getTime() < HORAS_NUEVA * 3600_000,
        // % de las habilidades del rol que tiene el postulante (100 si el rol no pide ninguna)
        matchPercent: pedidas.size ? Math.round((tiene / pedidas.size) * 100) : 100,
        applicant: {
          id: a.usuario.id,
          name: `${a.usuario.nombres} ${a.usuario.apellidos}`.trim(),
          initials: iniciales(a.usuario),
          photoUrl: pf?.fotoUrl ?? null,
          headline: pf?.titular ?? null,
          location: pf?.ubicacion ?? null,
          hoursPerWeek: pf?.disponibilidadHorasSem ?? null,
          projectsCount: a.usuario._count.proyectosCreados + a.usuario._count.membresias,
          skills: a.usuario.habilidades
            .map((h) => ({ id: h.habilidad.id, name: h.habilidad.nombre, matches: pedidas.has(String(h.habilidad.id)) }))
            .sort((x, y) => Number(y.matches) - Number(x.matches) || x.name.localeCompare(y.name)),
          links: { portfolio: pf?.linkPortafolio ?? null, linkedin: pf?.linkLinkedin ?? null, github: pf?.linkGithub ?? null },
        },
      };
    });

    cards.sort((x, y) =>
      f.sort === "match"
        ? y.matchPercent - x.matchPercent || y.createdAt.getTime() - x.createdAt.getTime()
        : y.createdAt.getTime() - x.createdAt.getTime(),
    );

    const rolesFiltrados = f.roleId ? p.roles.filter((r) => r.id === f.roleId) : p.roles;
    return {
      roleCounts: p.roles.map((r) => ({
        roleId: r.id,
        name: r.nombre,
        count: porRol.find((x) => x.rolProyectoId === r.id)?._count._all ?? 0,
      })),
      total: cards.length,
      vacancies: rolesFiltrados.reduce((a, r) => a + r.vacantesDisponibles, 0),
      page: f.page,
      limit: f.limit,
      items: cards.slice((f.page - 1) * f.limit, f.page * f.limit),
    };
  },

  async accept(id: bigint, userId: bigint) {
    const a = await postulacionDelCreador(id, userId);
    if (!ESTADOS_ACEPTAN.includes(a.proyecto.estado)) {
      throw HttpError.conflict("El proyecto no está abierto ni en curso", "PROJECT_NOT_OPEN");
    }
    const updated = await prisma.$transaction(async (tx) => {
      // Descuento condicional: si dos aceptaciones compiten por la última vacante, solo una gana
      const vacante = await tx.rolProyecto.updateMany({
        where: { id: a.rolProyectoId, vacantesDisponibles: { gt: 0 } },
        data: { vacantesDisponibles: { decrement: 1 } },
      });
      if (!vacante.count) throw HttpError.conflict("El rol ya no tiene vacantes disponibles", "NO_VACANCIES");

      const resuelta = await tx.postulacion.updateMany({
        where: { id, estado: "Pendiente" },
        data: { estado: "Aceptada", fechaResolucion: new Date() },
      });
      if (!resuelta.count) throw HttpError.conflict("La postulación ya fue resuelta", "NOT_PENDING");

      await tx.miembroEquipo.create({ data: { usuarioId: a.usuarioId, rolProyectoId: a.rolProyectoId } });
      return tx.postulacion.findUniqueOrThrow({ where: { id }, select: applicationSelect });
    });
    await notificar([a.usuarioId], {
      tipo: "Postulacion_Aceptada",
      mensaje: `¡Te aceptaron como ${a.rolProyecto.nombre} en ${a.proyecto.titulo}!`,
      ref: { tipo: "Postulacion", id },
      payload: { projectId: a.proyectoId, projectName: a.proyecto.titulo, roleId: a.rolProyectoId, roleName: a.rolProyecto.nombre, applicationId: id },
    });
    return { application: toApplicationDto(updated) };
  },

  async reject(id: bigint, userId: bigint) {
    const pa = await postulacionDelCreador(id, userId);
    const resuelta = await prisma.postulacion.updateMany({
      where: { id, estado: "Pendiente" },
      data: { estado: "Rechazada", fechaResolucion: new Date() },
    });
    if (!resuelta.count) throw HttpError.conflict("La postulación ya fue resuelta", "NOT_PENDING");
    const a = await prisma.postulacion.findUniqueOrThrow({ where: { id }, select: applicationSelect });
    await notificar([pa.usuarioId], {
      tipo: "Postulacion_Rechazada",
      mensaje: `Tu postulación a ${pa.rolProyecto.nombre} en ${pa.proyecto.titulo} no fue seleccionada`,
      ref: { tipo: "Postulacion", id },
      payload: { projectId: pa.proyectoId, projectName: pa.proyecto.titulo, roleId: pa.rolProyectoId, roleName: pa.rolProyecto.nombre, applicationId: id, reason: "rejected" },
    });
    return { application: toApplicationDto(a) };
  },
};
