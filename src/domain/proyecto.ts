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
