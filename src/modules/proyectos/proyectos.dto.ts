import { modalityFromDb, statusFromDb } from "../../domain/proyecto.js";

// ---------------------------------------------------------------------------
// project: { id, name, summary, description, category, modality, status, roles[], ... }
// role:    { id, name, description, dedication, vacancies, vacanciesAvailable, skills[] }
// ---------------------------------------------------------------------------

export const roleSelect = {
  id: true,
  nombre: true,
  descripcion: true,
  dedicacion: true,
  vacantesTotales: true,
  vacantesDisponibles: true,
  habilidades: { select: { habilidad: { select: { id: true, nombre: true } } }, orderBy: { habilidad: { nombre: "asc" } } },
} as const;

export const projectSelect = {
  id: true,
  creadorId: true,
  titulo: true,
  resumen: true,
  descripcion: true,
  modalidad: true,
  estado: true,
  fechaCreacion: true,
  fechaPublicacion: true,
  fechaActualizacion: true,
  categoria: { select: { id: true, nombre: true } },
  roles: { select: roleSelect, orderBy: { fechaCreacion: "asc" } },
} as const;

export interface RoleRow {
  id: bigint;
  nombre: string;
  descripcion: string | null;
  dedicacion: string;
  vacantesTotales: number;
  vacantesDisponibles: number;
  habilidades: { habilidad: { id: bigint; nombre: string } }[];
}

export interface ProjectRow {
  id: bigint;
  creadorId: bigint;
  titulo: string;
  resumen: string | null;
  descripcion: string | null;
  modalidad: string | null;
  estado: string;
  fechaCreacion: Date;
  fechaPublicacion: Date | null;
  fechaActualizacion: Date;
  categoria: { id: bigint; nombre: string } | null;
  roles: RoleRow[];
}

export function toRoleDto(r: RoleRow) {
  return {
    id: r.id,
    name: r.nombre,
    description: r.descripcion,
    dedication: r.dedicacion,
    vacancies: r.vacantesTotales,
    vacanciesAvailable: r.vacantesDisponibles,
    skills: r.habilidades.map((h) => ({ id: h.habilidad.id, name: h.habilidad.nombre })),
  };
}

export function toProjectDto(p: ProjectRow) {
  return {
    id: p.id,
    creatorId: p.creadorId,
    name: p.titulo,
    summary: p.resumen,
    description: p.descripcion,
    category: p.categoria ? { id: p.categoria.id, name: p.categoria.nombre } : null,
    modality: modalityFromDb(p.modalidad),
    status: statusFromDb(p.estado),
    createdAt: p.fechaCreacion,
    publishedAt: p.fechaPublicacion,
    updatedAt: p.fechaActualizacion,
    roles: p.roles.map(toRoleDto),
  };
}
