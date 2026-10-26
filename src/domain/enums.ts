// Valores permitidos por los CHECK del ER. Úsalos en validaciones (zod) y en
// la lógica de negocio para no escribir strings "a mano".

export const ROL_GLOBAL = ["Creador", "Colaborador"] as const;
export const ESTADO_USUARIO = ["Pendiente_Verificacion", "Verificado", "Suspendido", "Baja"] as const;
export const TIPO_HABILIDAD = ["Tecnica", "Interes"] as const;
export const ESTADO_PROYECTO = ["Abierto", "En_Curso", "Pausado", "Cerrado", "Cancelado"] as const;
export const ESTADO_POSTULACION = ["Pendiente", "Aceptada", "Rechazada", "Cancelada_Colaborador"] as const;
export const ESTADO_MIEMBRO = ["Activo", "Retirado", "Removido"] as const;
export const TIPO_NOTIFICACION = [
  "Nueva_Postulacion",
  "Cambio_Estado_Postulacion",
  "Nuevo_Mensaje",
  "Cambio_Proyecto",
  "Reporte_Resuelto",
  "Insignia_Obtenida",
] as const;
export const ENTIDAD_REF_NOTIFICACION = ["Proyecto", "Postulacion", "Mensaje", "Reporte", "Insignia"] as const;
export const ESTADO_EMAIL = ["Pendiente", "Enviado", "Fallido"] as const;
export const TIPO_ENTIDAD_REPORTE = ["Proyecto", "Mensaje", "Usuario"] as const;
export const ESTADO_REPORTE = ["Pendiente", "En_Revision", "Resuelto", "Desestimado"] as const;
export const PLATAFORMA_ENTREGA = ["GitHub", "Figma", "Trello", "Otro"] as const;
export const TIPO_TOKEN = ["Verificacion_Email", "Reset_Password"] as const;

export type RolGlobal = (typeof ROL_GLOBAL)[number];
export type EstadoUsuario = (typeof ESTADO_USUARIO)[number];
export type EstadoProyecto = (typeof ESTADO_PROYECTO)[number];
export type EstadoPostulacion = (typeof ESTADO_POSTULACION)[number];
export type EstadoMiembro = (typeof ESTADO_MIEMBRO)[number];
export type TipoNotificacion = (typeof TIPO_NOTIFICACION)[number];
export type TipoToken = (typeof TIPO_TOKEN)[number];

// Límites del ER
export const MAX_ADJUNTO_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_INTENTOS_EMAIL = 3;
