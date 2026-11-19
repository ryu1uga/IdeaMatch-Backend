-- =============================================================================
--  Sprint 7 - Notificaciones in-app y reportes
--   - notificacion: payload JSON y nuevos tipos
--   - reporte: categoría (motivo del contrato) y severidad para moderación
-- =============================================================================

-- AlterTable notificacion
ALTER TABLE "notificacion" ADD COLUMN "datos" JSONB;

ALTER TABLE "notificacion" DROP CONSTRAINT "notificacion_tipo_ck";
ALTER TABLE "notificacion"
  ADD CONSTRAINT "notificacion_tipo_ck"
    CHECK ("tipo" IN ('Nueva_Postulacion','Cambio_Estado_Postulacion','Nuevo_Mensaje',
                      'Cambio_Proyecto','Reporte_Resuelto','Insignia_Obtenida',
                      'Postulacion_Aceptada','Postulacion_Rechazada','Miembro_Retirado',
                      'Miembro_Removido','Proyecto_Cancelado','Proyecto_Suspendido'));

-- AlterTable reporte (default temporal para filas existentes)
ALTER TABLE "reporte"
  ADD COLUMN "categoria" VARCHAR(30) NOT NULL DEFAULT 'otro',
  ADD COLUMN "severidad" VARCHAR(10) NOT NULL DEFAULT 'baja';
ALTER TABLE "reporte"
  ALTER COLUMN "categoria" DROP DEFAULT,
  ALTER COLUMN "severidad" DROP DEFAULT;
ALTER TABLE "reporte"
  ADD CONSTRAINT "reporte_categoria_ck"
    CHECK ("categoria" IN ('spam','contenido_enganoso','propiedad_intelectual','otro')),
  ADD CONSTRAINT "reporte_severidad_ck"
    CHECK ("severidad" IN ('alta','media','baja'));

-- CreateIndex (moderación filtra por severidad)
CREATE INDEX "reporte_severidad_idx" ON "reporte"("severidad");
