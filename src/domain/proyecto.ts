import { DEDICACION_ROL, ESTADO_PROYECTO, MODALIDAD_PROYECTO } from "./enums.js";

// ---------------------------------------------------------------------------
// Proyecto: valores de la API (minúsculas, contrato del front) <-> valores en la BD.
// ---------------------------------------------------------------------------

export type EstadoProyectoDb = (typeof ESTADO_PROYECTO)[number];
export type ModalidadDb = (typeof MODALIDAD_PROYECTO)[number];

export const PROJECT_STATUS = ["borrador", "abierto", "en_curso", "pausado", "cerrado", "cancelado"] as const;
export type ProjectStatus = (typeof PROJECT_STATUS)[number];

/** Estados que se pueden pedir en PATCH /projects/:id/status */
export const PROJECT_STATUS_TARGET = ["abierto", "en_curso", "pausado", "cerrado"] as const;

export const MODALITY = ["remoto", "presencial", "hibrido"] as const;
export type Modality = (typeof MODALITY)[number];

export const DEDICATION = DEDICACION_ROL;

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const statusToDb = (s: ProjectStatus) => s.split("_").map(capitalizar).join("_") as EstadoProyectoDb;
export const statusFromDb = (s: string) => s.toLowerCase() as ProjectStatus;
export const modalityToDb = (m: Modality) => capitalizar(m) as ModalidadDb;
export const modalityFromDb = (m: string | null) => (m ? (m.toLowerCase() as Modality) : null);

/** Estados finales: ya no se edita el proyecto ni sus roles */
export const ESTADOS_FINALES: readonly EstadoProyectoDb[] = ["Cerrado", "Cancelado"];

/**
 * Transiciones válidas con PATCH /projects/:id/status.
 * Borrador -> Abierto se hace con POST /projects/:id/publish y la cancelación con POST /projects/:id/cancel.
 */
export const TRANSICIONES: Record<EstadoProyectoDb, readonly EstadoProyectoDb[]> = {
  Borrador: [],
  Abierto: ["En_Curso", "Pausado", "Cerrado"],
  En_Curso: ["Abierto", "Pausado", "Cerrado"],
  Pausado: ["Abierto", "En_Curso", "Cerrado"],
  Cerrado: [],
  Cancelado: [],
};

/** Estados visibles en el catálogo público (el resto solo lo ve el creador) */
export const PROJECT_STATUS_PUBLIC = ["abierto", "en_curso", "pausado", "cerrado"] as const;

// Portadas degradadas de las tarjetas: un par de colores fijo por categoría (o por proyecto si no tiene)
const PORTADAS: [string, string][] = [
  ["#3b2a8c", "#7a5cec"],
  ["#1d6b5c", "#5fcf9f"],
  ["#a3405a", "#f39a5a"],
  ["#1e4f8a", "#5aa8f3"],
  ["#6b2d8a", "#c77df3"],
  ["#8a5a1d", "#f3c75a"],
  ["#1f5f7a", "#5fd0e0"],
  ["#7a1f3d", "#f06a8f"],
];
export function portada(projectId: bigint, categoryId: bigint | null) {
  const par = PORTADAS[Number((categoryId ?? projectId) % BigInt(PORTADAS.length))];
  return { coverColor: par[1], coverGradient: par };
}

// Estados de una postulación: BD <-> API
const POSTULACION_API: Record<string, string> = {
  Pendiente: "pendiente",
  Aceptada: "aceptada",
  Rechazada: "rechazada",
  Cancelada_Colaborador: "cancelada",
};
export const applicationStatusFromDb = (s: string) => POSTULACION_API[s] ?? s.toLowerCase();
