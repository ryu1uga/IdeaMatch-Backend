// Tipos de notificación: valor en la BD <-> valor de la API (`type`)

export const NOTIFICATION_TYPES = {
  Nueva_Postulacion: "new_application",
  Postulacion_Aceptada: "application_accepted",
  Postulacion_Rechazada: "application_rejected",
  Cambio_Proyecto: "project_status_changed",
  Proyecto_Cancelado: "project_cancelled",
  Proyecto_Suspendido: "project_suspended",
  Miembro_Retirado: "member_left",
  Miembro_Removido: "member_removed",
  Reporte_Resuelto: "report_resolved",
  Nuevo_Mensaje: "new_message",
  Cambio_Estado_Postulacion: "application_status_changed",
  Insignia_Obtenida: "badge_earned",
} as const;

export type TipoNotificacionDb = keyof typeof NOTIFICATION_TYPES;
export const notificationTypeFromDb = (t: string) => NOTIFICATION_TYPES[t as TipoNotificacionDb] ?? t;
