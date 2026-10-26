-- =============================================================================
--  IdeaMatch - Restricciones que Prisma no soporta en schema.prisma
--  YA ESTÁN INCLUIDAS al final de prisma/migrations/20261026170000_init.
--  Este archivo queda como referencia para escribir los CHECK de futuras
--  migraciones. No lo ejecutes sobre una BD ya migrada.
-- =============================================================================

-- ---------- 1. Usuario --------------------------------------------------------
ALTER TABLE "usuario"
  ADD CONSTRAINT "usuario_rol_global_ck"
    CHECK ("rol_global" IN ('Creador','Colaborador')),
  ADD CONSTRAINT "usuario_estado_ck"
    CHECK ("estado" IN ('Pendiente_Verificacion','Verificado','Suspendido','Baja'));

-- ---------- 2. Perfil ---------------------------------------------------------
ALTER TABLE "perfil"
  ADD CONSTRAINT "perfil_disponibilidad_ck"
    CHECK ("disponibilidad_horas_sem" IS NULL OR "disponibilidad_horas_sem" BETWEEN 1 AND 80);

-- ---------- 3. Habilidad ------------------------------------------------------
ALTER TABLE "habilidad"
  ADD CONSTRAINT "habilidad_tipo_ck"
    CHECK ("tipo" IN ('Tecnica','Interes'));

-- ---------- 5. Proyecto -------------------------------------------------------
ALTER TABLE "proyecto"
  ADD CONSTRAINT "proyecto_estado_ck"
    CHECK ("estado" IN ('Abierto','En_Curso','Pausado','Cerrado','Cancelado'));

-- Búsqueda full-text sobre título + resumen (índice GIN opcional del ER)
CREATE INDEX "proyecto_busqueda_gin_idx" ON "proyecto"
  USING GIN (to_tsvector('spanish', "titulo" || ' ' || "resumen"));

-- ---------- 6. RolProyecto ----------------------------------------------------
ALTER TABLE "rol_proyecto"
  ADD CONSTRAINT "rol_proyecto_vacantes_totales_ck"
    CHECK ("vacantes_totales" > 0),
  ADD CONSTRAINT "rol_proyecto_vacantes_disponibles_ck"
    CHECK ("vacantes_disponibles" BETWEEN 0 AND "vacantes_totales");

-- ---------- 7. Postulacion ----------------------------------------------------
ALTER TABLE "postulacion"
  ADD CONSTRAINT "postulacion_estado_ck"
    CHECK ("estado" IN ('Pendiente','Aceptada','Rechazada','Cancelada_Colaborador'));

-- proyecto_id debe coincidir con rol_proyecto.proyecto_id
CREATE OR REPLACE FUNCTION fn_validar_postulacion() RETURNS trigger AS $$
DECLARE
  v_proyecto_id BIGINT;
BEGIN
  SELECT "proyecto_id" INTO v_proyecto_id
  FROM "rol_proyecto" WHERE "id" = NEW."rol_proyecto_id";

  IF v_proyecto_id IS NULL OR v_proyecto_id <> NEW."proyecto_id" THEN
    RAISE EXCEPTION 'postulacion.proyecto_id (%) no coincide con rol_proyecto.proyecto_id (%)',
      NEW."proyecto_id", v_proyecto_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_validar_postulacion"
  BEFORE INSERT OR UPDATE OF "rol_proyecto_id", "proyecto_id" ON "postulacion"
  FOR EACH ROW EXECUTE FUNCTION fn_validar_postulacion();

-- ---------- 8. MiembroEquipo --------------------------------------------------
ALTER TABLE "miembro_equipo"
  ADD CONSTRAINT "miembro_equipo_estado_ck"
    CHECK ("estado" IN ('Activo','Retirado','Removido')),
  ADD CONSTRAINT "miembro_equipo_fecha_baja_ck"
    CHECK ("estado" = 'Activo' OR "fecha_baja" IS NOT NULL),
  ADD CONSTRAINT "miembro_equipo_motivo_baja_ck"
    CHECK ("estado" <> 'Removido' OR "motivo_baja" IS NOT NULL);

-- Un usuario activo una sola vez por rol
CREATE UNIQUE INDEX "miembro_equipo_activo_uq"
  ON "miembro_equipo" ("usuario_id", "rol_proyecto_id")
  WHERE "estado" = 'Activo';

-- ---------- 11. Adjunto -------------------------------------------------------
ALTER TABLE "adjunto"
  ADD CONSTRAINT "adjunto_tamano_ck"
    CHECK ("tamano_bytes" BETWEEN 0 AND 10485760);

-- ---------- 12. Notificacion --------------------------------------------------
ALTER TABLE "notificacion"
  ADD CONSTRAINT "notificacion_tipo_ck"
    CHECK ("tipo" IN ('Nueva_Postulacion','Cambio_Estado_Postulacion','Nuevo_Mensaje',
                      'Cambio_Proyecto','Reporte_Resuelto','Insignia_Obtenida')),
  ADD CONSTRAINT "notificacion_entidad_ref_tipo_ck"
    CHECK ("entidad_ref_tipo" IS NULL OR
           "entidad_ref_tipo" IN ('Proyecto','Postulacion','Mensaje','Reporte','Insignia'));

-- ---------- 13. NotificacionEmail ---------------------------------------------
ALTER TABLE "notificacion_email"
  ADD CONSTRAINT "notificacion_email_estado_ck"
    CHECK ("estado" IN ('Pendiente','Enviado','Fallido')),
  ADD CONSTRAINT "notificacion_email_intentos_ck"
    CHECK ("intentos" BETWEEN 0 AND 3);

-- ---------- 14. Reporte -------------------------------------------------------
ALTER TABLE "reporte"
  ADD CONSTRAINT "reporte_tipo_entidad_ck"
    CHECK ("tipo_entidad" IN ('Proyecto','Mensaje','Usuario')),
  ADD CONSTRAINT "reporte_estado_ck"
    CHECK ("estado" IN ('Pendiente','En_Revision','Resuelto','Desestimado'));

-- ---------- 15. EntregaProyecto -----------------------------------------------
ALTER TABLE "entrega_proyecto"
  ADD CONSTRAINT "entrega_proyecto_plataforma_ck"
    CHECK ("plataforma" IN ('GitHub','Figma','Trello','Otro'));

-- ---------- 18. Token ---------------------------------------------------------
ALTER TABLE "token"
  ADD CONSTRAINT "token_tipo_ck"
    CHECK ("tipo" IN ('Verificacion_Email','Reset_Password'));
