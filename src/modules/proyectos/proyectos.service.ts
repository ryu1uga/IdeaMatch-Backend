import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/http-error.js";
import {
  ESTADOS_FINALES,
  TRANSICIONES,
  modalityToDb,
  statusFromDb,
  statusToDb,
  type EstadoProyectoDb,
  type ProjectStatus,
} from "../../domain/proyecto.js";
import type { CreateProjectInput, CreateRoleInput, UpdateProjectInput, UpdateRoleInput } from "./proyectos.schemas.js";
import { projectSelect, roleSelect, toProjectDto, toRoleDto } from "./proyectos.dto.js";

type Tx = Prisma.TransactionClient;

const MAX_VACANTES = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Proyecto del usuario autenticado: 404 si no existe, 403 si no es el creador */
async function proyectoPropio(id: bigint, userId: bigint, db: Tx | typeof prisma = prisma) {
  const p = await db.proyecto.findUnique({ where: { id }, select: { id: true, creadorId: true, estado: true } });
  if (!p) throw HttpError.notFound("El proyecto no existe", "PROJECT_NOT_FOUND");
  if (p.creadorId !== userId) throw HttpError.forbidden("Solo el creador puede modificar el proyecto", "NOT_OWNER");
  return p as { id: bigint; creadorId: bigint; estado: EstadoProyectoDb };
}

function exigirEditable(estado: EstadoProyectoDb) {
  if (ESTADOS_FINALES.includes(estado)) {
    throw HttpError.conflict(`El proyecto está ${statusFromDb(estado)} y ya no se puede modificar`, "PROJECT_CLOSED");
  }
}

async function validarCategoria(categoryId: bigint | null | undefined) {
  if (categoryId == null) return;
  const ok = await prisma.categoria.count({ where: { id: categoryId, activa: true } });
  if (!ok) throw HttpError.badRequest("La categoría no existe o no está activa", "INVALID_CATEGORY");
}

async function validarHabilidades(ids: bigint[]) {
  if (!ids.length) return;
  const n = await prisma.habilidad.count({ where: { id: { in: ids }, activa: true, tipo: "Tecnica" } });
  if (n !== ids.length) throw HttpError.badRequest("Alguna habilidad no existe o no está activa", "INVALID_SKILL");
}

function validarVacantes(v: number) {
  if (!Number.isInteger(v) || v < 1 || v > MAX_VACANTES) {
    throw HttpError.badRequest(`Las vacantes deben ser un entero entre 1 y ${MAX_VACANTES}`, "INVALID_VACANCIES");
  }
}

async function validarNombreRol(proyectoId: bigint, nombre: string, exceptoRolId?: bigint) {
  const existe = await prisma.rolProyecto.findFirst({
    where: { proyectoId, nombre: { equals: nombre, mode: "insensitive" }, ...(exceptoRolId && { id: { not: exceptoRolId } }) },
    select: { id: true },
  });
  if (existe) throw HttpError.conflict("El proyecto ya tiene un rol con ese nombre", "ROLE_NAME_TAKEN");
}

const uniq = (ids: bigint[]) => [...new Set(ids.map(String))].map((x) => BigInt(x));

async function getProject(id: bigint, db: Tx | typeof prisma = prisma) {
  return toProjectDto(await db.proyecto.findUniqueOrThrow({ where: { id }, select: projectSelect }));
}

/** Rechaza las postulaciones pendientes (al cerrar o cancelar el proyecto) */
function cerrarPostulacionesPendientes(tx: Tx, proyectoId: bigint) {
  return tx.postulacion.updateMany({
    where: { proyectoId, estado: "Pendiente" },
    data: { estado: "Rechazada", fechaResolucion: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Servicio
// ---------------------------------------------------------------------------

export const proyectosService = {
  async create(userId: bigint, input: CreateProjectInput) {
    await validarCategoria(input.categoryId);
    const p = await prisma.proyecto.create({
      data: {
        creadorId: userId,
        titulo: input.name,
        resumen: input.summary ?? null,
        descripcion: input.description ?? null,
        categoriaId: input.categoryId ?? null,
        modalidad: input.modality ? modalityToDb(input.modality) : null,
      },
      select: projectSelect,
    });
    return { project: toProjectDto(p) };
  },

  async update(id: bigint, userId: bigint, input: UpdateProjectInput) {
    const p = await proyectoPropio(id, userId);
    exigirEditable(p.estado);
    await validarCategoria(input.categoryId);

    // Un proyecto publicado no puede quedar sin los campos obligatorios
    if (p.estado !== "Borrador") {
      for (const k of ["summary", "categoryId", "modality"] as const) {
        if (input[k] === null) throw HttpError.badRequest(`${k} es obligatorio en un proyecto publicado`, "VALIDATION");
      }
    }

    const updated = await prisma.proyecto.update({
      where: { id },
      data: {
        titulo: input.name,
        resumen: input.summary,
        descripcion: input.description,
        categoriaId: input.categoryId,
        modalidad: input.modality === undefined ? undefined : input.modality && modalityToDb(input.modality),
      },
      select: projectSelect,
    });
    return { project: toProjectDto(updated) };
  },

  async listMine(userId: bigint, status?: ProjectStatus) {
    const rows = await prisma.proyecto.findMany({
      where: { creadorId: userId, ...(status && { estado: statusToDb(status) }) },
      orderBy: { fechaActualizacion: "desc" },
      select: {
        id: true,
        titulo: true,
        resumen: true,
        estado: true,
        fechaCreacion: true,
        fechaActualizacion: true,
        categoria: { select: { id: true, nombre: true } },
        roles: { select: { vacantesTotales: true, vacantesDisponibles: true } },
        _count: { select: { postulaciones: { where: { estado: "Pendiente" } } } },
      },
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.titulo,
      summary: p.resumen,
      category: p.categoria ? { id: p.categoria.id, name: p.categoria.nombre } : null,
      status: statusFromDb(p.estado),
      // roles completos (sin vacantes libres) y roles con vacantes por cubrir
      rolesCovered: p.roles.filter((r) => r.vacantesDisponibles === 0).length,
      rolesPending: p.roles.filter((r) => r.vacantesDisponibles > 0).length,
      vacancies: p.roles.reduce((a, r) => a + r.vacantesTotales, 0),
      vacanciesAvailable: p.roles.reduce((a, r) => a + r.vacantesDisponibles, 0),
      pendingApplications: p._count.postulaciones,
      createdAt: p.fechaCreacion,
      updatedAt: p.fechaActualizacion,
    }));
  },

  // ---------------- Roles

  async createRole(projectId: bigint, userId: bigint, input: CreateRoleInput) {
    const p = await proyectoPropio(projectId, userId);
    exigirEditable(p.estado);
    validarVacantes(input.vacancies);
    const skillIds = uniq(input.skillIds);
    await validarHabilidades(skillIds);
    await validarNombreRol(projectId, input.name);

    const rol = await prisma.rolProyecto.create({
      data: {
        proyectoId: projectId,
        nombre: input.name,
        descripcion: input.description ?? null,
        dedicacion: input.dedication,
        vacantesTotales: input.vacancies,
        vacantesDisponibles: input.vacancies,
        habilidades: { create: skillIds.map((habilidadId) => ({ habilidadId })) },
      },
      select: roleSelect,
    });
    return { role: toRoleDto(rol) };
  },

  async updateRole(projectId: bigint, roleId: bigint, userId: bigint, input: UpdateRoleInput) {
    const p = await proyectoPropio(projectId, userId);
    exigirEditable(p.estado);
    const rol = await prisma.rolProyecto.findFirst({
      where: { id: roleId, proyectoId: projectId },
      select: { vacantesTotales: true, vacantesDisponibles: true },
    });
    if (!rol) throw HttpError.notFound("El rol no existe en este proyecto", "ROLE_NOT_FOUND");

    let vacantes: { vacantesTotales: number; vacantesDisponibles: number } | undefined;
    if (input.vacancies !== undefined) {
      validarVacantes(input.vacancies);
      const ocupadas = rol.vacantesTotales - rol.vacantesDisponibles;
      if (input.vacancies < ocupadas) {
        throw HttpError.conflict(
          `El rol ya tiene ${ocupadas} miembro(s); las vacantes no pueden ser menos`,
          "VACANCIES_BELOW_MEMBERS",
        );
      }
      vacantes = { vacantesTotales: input.vacancies, vacantesDisponibles: input.vacancies - ocupadas };
    }
    const skillIds = input.skillIds && uniq(input.skillIds);
    if (skillIds) await validarHabilidades(skillIds);
    if (input.name) await validarNombreRol(projectId, input.name, roleId);

    const updated = await prisma.rolProyecto.update({
      where: { id: roleId },
      data: {
        nombre: input.name,
        descripcion: input.description,
        dedicacion: input.dedication,
        ...vacantes,
        ...(skillIds && {
          habilidades: { deleteMany: {}, create: skillIds.map((habilidadId) => ({ habilidadId })) },
        }),
      },
      select: roleSelect,
    });
    return { role: toRoleDto(updated) };
  },

  async deleteRole(projectId: bigint, roleId: bigint, userId: bigint) {
    const p = await proyectoPropio(projectId, userId);
    exigirEditable(p.estado);
    const rol = await prisma.rolProyecto.findFirst({
      where: { id: roleId, proyectoId: projectId },
      select: { vacantesTotales: true, vacantesDisponibles: true },
    });
    if (!rol) throw HttpError.notFound("El rol no existe en este proyecto", "ROLE_NOT_FOUND");
    if (rol.vacantesTotales !== rol.vacantesDisponibles) {
      throw HttpError.conflict("El rol tiene miembros en el equipo; no se puede eliminar", "ROLE_HAS_MEMBERS");
    }
    if (p.estado !== "Borrador") {
      const total = await prisma.rolProyecto.count({ where: { proyectoId: projectId } });
      if (total <= 1) throw HttpError.conflict("Un proyecto publicado debe tener al menos un rol", "NO_ROLES");
    }
    // Las postulaciones a ese rol se eliminan en cascada
    await prisma.rolProyecto.delete({ where: { id: roleId } });
  },

  // ---------------- Estados

  async publish(id: bigint, userId: bigint) {
    const p = await proyectoPropio(id, userId);
    if (p.estado !== "Borrador") {
      throw HttpError.conflict("Solo se puede publicar un proyecto en borrador", "INVALID_TRANSITION");
    }
    const actual = await prisma.proyecto.findUniqueOrThrow({
      where: { id },
      select: { resumen: true, categoriaId: true, modalidad: true, _count: { select: { roles: true } } },
    });
    const faltan = [
      !actual.resumen && "summary",
      !actual.categoriaId && "categoryId",
      !actual.modalidad && "modality",
    ].filter(Boolean);
    if (faltan.length) {
      throw new HttpError(409, "INCOMPLETE_PROJECT", "Completa los datos obligatorios antes de publicar", { missing: faltan });
    }
    if (!actual._count.roles) throw HttpError.conflict("Agrega al menos un rol antes de publicar", "NO_ROLES");

    await prisma.proyecto.update({ where: { id }, data: { estado: "Abierto", fechaPublicacion: new Date() } });
    return { project: await getProject(id) };
  },

  async changeStatus(id: bigint, userId: bigint, status: ProjectStatus) {
    const p = await proyectoPropio(id, userId);
    const destino = statusToDb(status);
    if (!TRANSICIONES[p.estado].includes(destino)) {
      throw new HttpError(409, "INVALID_TRANSITION", `No se puede pasar de ${statusFromDb(p.estado)} a ${status}`, {
        from: statusFromDb(p.estado),
        allowed: TRANSICIONES[p.estado].map(statusFromDb),
      });
    }
    return prisma.$transaction(async (tx) => {
      await tx.proyecto.update({ where: { id }, data: { estado: destino } });
      if (destino === "Cerrado") await cerrarPostulacionesPendientes(tx, id);
      return { project: await getProject(id, tx) };
    });
  },

  async cancel(id: bigint, userId: bigint) {
    const p = await proyectoPropio(id, userId);
    if (ESTADOS_FINALES.includes(p.estado)) {
      throw HttpError.conflict(`El proyecto ya está ${statusFromDb(p.estado)}`, "INVALID_TRANSITION");
    }
    return prisma.$transaction(async (tx) => {
      await tx.proyecto.update({ where: { id }, data: { estado: "Cancelado" } });
      await cerrarPostulacionesPendientes(tx, id);
      return { project: await getProject(id, tx) };
    });
  },
};
