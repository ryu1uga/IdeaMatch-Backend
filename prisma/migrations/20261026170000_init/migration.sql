-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "usuario" (
    "id" BIGSERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "rol_global" VARCHAR(20) NOT NULL,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'Pendiente_Verificacion',
    "fecha_registro" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfil" (
    "usuario_id" BIGINT NOT NULL,
    "nombre_visible" VARCHAR(100) NOT NULL,
    "biografia" TEXT,
    "foto_url" VARCHAR(500),
    "disponibilidad_horas_sem" SMALLINT,
    "fecha_actualizacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "perfil_pkey" PRIMARY KEY ("usuario_id")
);

-- CreateTable
CREATE TABLE "habilidad" (
    "id" BIGSERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "habilidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria" (
    "id" BIGSERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyecto" (
    "id" BIGSERIAL NOT NULL,
    "creador_id" BIGINT NOT NULL,
    "titulo" VARCHAR(150) NOT NULL,
    "resumen" VARCHAR(300) NOT NULL,
    "descripcion" TEXT,
    "categoria_id" BIGINT,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'Abierto',
    "fecha_publicacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_proyecto" (
    "id" BIGSERIAL NOT NULL,
    "proyecto_id" BIGINT NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "vacantes_totales" SMALLINT NOT NULL,
    "vacantes_disponibles" SMALLINT NOT NULL,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rol_proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postulacion" (
    "id" BIGSERIAL NOT NULL,
    "usuario_id" BIGINT NOT NULL,
    "rol_proyecto_id" BIGINT NOT NULL,
    "proyecto_id" BIGINT NOT NULL,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
    "nota_presentacion" TEXT,
    "fecha_postulacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_resolucion" TIMESTAMPTZ,

    CONSTRAINT "postulacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "miembro_equipo" (
    "id" BIGSERIAL NOT NULL,
    "usuario_id" BIGINT NOT NULL,
    "rol_proyecto_id" BIGINT NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'Activo',
    "fecha_ingreso" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_baja" TIMESTAMPTZ,
    "motivo_baja" TEXT,

    CONSTRAINT "miembro_equipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversacion" (
    "id" BIGSERIAL NOT NULL,
    "proyecto_id" BIGINT NOT NULL,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensaje" (
    "id" BIGSERIAL NOT NULL,
    "conversacion_id" BIGINT NOT NULL,
    "autor_id" BIGINT NOT NULL,
    "contenido" TEXT NOT NULL,
    "fecha_envio" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjunto" (
    "id" BIGSERIAL NOT NULL,
    "mensaje_id" BIGINT NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "tipo_mime" VARCHAR(100) NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,

    CONSTRAINT "adjunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacion" (
    "id" BIGSERIAL NOT NULL,
    "usuario_id" BIGINT NOT NULL,
    "tipo" VARCHAR(40) NOT NULL,
    "mensaje" VARCHAR(500) NOT NULL,
    "entidad_ref_tipo" VARCHAR(20),
    "entidad_ref_id" BIGINT,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_lectura" TIMESTAMPTZ,

    CONSTRAINT "notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacion_email" (
    "id" BIGSERIAL NOT NULL,
    "notificacion_id" BIGINT NOT NULL,
    "destinatario_email" VARCHAR(255) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
    "intentos" SMALLINT NOT NULL DEFAULT 0,
    "fecha_ultimo_intento" TIMESTAMPTZ,
    "error_detalle" TEXT,

    CONSTRAINT "notificacion_email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporte" (
    "id" BIGSERIAL NOT NULL,
    "reportante_id" BIGINT NOT NULL,
    "tipo_entidad" VARCHAR(20) NOT NULL,
    "id_entidad" BIGINT NOT NULL,
    "motivo" TEXT NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
    "admin_id" BIGINT,
    "resolucion" TEXT,
    "fecha_reporte" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_resolucion" TIMESTAMPTZ,

    CONSTRAINT "reporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entrega_proyecto" (
    "id" BIGSERIAL NOT NULL,
    "proyecto_id" BIGINT NOT NULL,
    "colaborador_id" BIGINT,
    "plataforma" VARCHAR(20) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "fecha_vinculacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entrega_proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insignia" (
    "id" BIGSERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(300),
    "criterio" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "insignia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_insignia" (
    "usuario_id" BIGINT NOT NULL,
    "insignia_id" BIGINT NOT NULL,
    "proyecto_id" BIGINT,
    "fecha_obtencion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_insignia_pkey" PRIMARY KEY ("usuario_id","insignia_id")
);

-- CreateTable
CREATE TABLE "token" (
    "id" BIGSERIAL NOT NULL,
    "usuario_id" BIGINT NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "valor" VARCHAR(255) NOT NULL,
    "expira_en" TIMESTAMPTZ NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_estado_idx" ON "usuario"("estado");

-- CreateIndex
CREATE INDEX "perfil_nombre_visible_idx" ON "perfil"("nombre_visible");

-- CreateIndex
CREATE UNIQUE INDEX "habilidad_nombre_key" ON "habilidad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_nombre_key" ON "categoria"("nombre");

-- CreateIndex
CREATE INDEX "proyecto_creador_id_idx" ON "proyecto"("creador_id");

-- CreateIndex
CREATE INDEX "proyecto_categoria_id_idx" ON "proyecto"("categoria_id");

-- CreateIndex
CREATE INDEX "proyecto_estado_idx" ON "proyecto"("estado");

-- CreateIndex
CREATE INDEX "proyecto_fecha_publicacion_idx" ON "proyecto"("fecha_publicacion" DESC);

-- CreateIndex
CREATE INDEX "rol_proyecto_proyecto_id_idx" ON "rol_proyecto"("proyecto_id");

-- CreateIndex
CREATE UNIQUE INDEX "rol_proyecto_proyecto_id_nombre_key" ON "rol_proyecto"("proyecto_id", "nombre");

-- CreateIndex
CREATE INDEX "postulacion_rol_proyecto_id_idx" ON "postulacion"("rol_proyecto_id");

-- CreateIndex
CREATE INDEX "postulacion_estado_idx" ON "postulacion"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "postulacion_usuario_id_proyecto_id_key" ON "postulacion"("usuario_id", "proyecto_id");

-- CreateIndex
CREATE INDEX "miembro_equipo_rol_proyecto_id_idx" ON "miembro_equipo"("rol_proyecto_id");

-- CreateIndex
CREATE INDEX "miembro_equipo_usuario_id_estado_idx" ON "miembro_equipo"("usuario_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "conversacion_proyecto_id_key" ON "conversacion"("proyecto_id");

-- CreateIndex
CREATE INDEX "mensaje_conversacion_id_fecha_envio_idx" ON "mensaje"("conversacion_id", "fecha_envio" DESC);

-- CreateIndex
CREATE INDEX "mensaje_autor_id_idx" ON "mensaje"("autor_id");

-- CreateIndex
CREATE INDEX "adjunto_mensaje_id_idx" ON "adjunto"("mensaje_id");

-- CreateIndex
CREATE INDEX "notificacion_usuario_id_leida_idx" ON "notificacion"("usuario_id", "leida");

-- CreateIndex
CREATE INDEX "notificacion_fecha_creacion_idx" ON "notificacion"("fecha_creacion" DESC);

-- CreateIndex
CREATE INDEX "notificacion_email_notificacion_id_idx" ON "notificacion_email"("notificacion_id");

-- CreateIndex
CREATE INDEX "notificacion_email_estado_idx" ON "notificacion_email"("estado");

-- CreateIndex
CREATE INDEX "reporte_estado_idx" ON "reporte"("estado");

-- CreateIndex
CREATE INDEX "reporte_tipo_entidad_id_entidad_idx" ON "reporte"("tipo_entidad", "id_entidad");

-- CreateIndex
CREATE UNIQUE INDEX "reporte_reportante_id_tipo_entidad_id_entidad_key" ON "reporte"("reportante_id", "tipo_entidad", "id_entidad");

-- CreateIndex
CREATE UNIQUE INDEX "entrega_proyecto_url_key" ON "entrega_proyecto"("url");

-- CreateIndex
CREATE INDEX "entrega_proyecto_proyecto_id_idx" ON "entrega_proyecto"("proyecto_id");

-- CreateIndex
CREATE UNIQUE INDEX "insignia_nombre_key" ON "insignia"("nombre");

-- CreateIndex
CREATE INDEX "usuario_insignia_usuario_id_idx" ON "usuario_insignia"("usuario_id");

-- CreateIndex
CREATE INDEX "usuario_insignia_insignia_id_idx" ON "usuario_insignia"("insignia_id");

-- CreateIndex
CREATE UNIQUE INDEX "token_valor_key" ON "token"("valor");

-- CreateIndex
CREATE INDEX "token_usuario_id_tipo_idx" ON "token"("usuario_id", "tipo");

-- AddForeignKey
ALTER TABLE "perfil" ADD CONSTRAINT "perfil_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto" ADD CONSTRAINT "proyecto_creador_id_fkey" FOREIGN KEY ("creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto" ADD CONSTRAINT "proyecto_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_proyecto" ADD CONSTRAINT "rol_proyecto_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postulacion" ADD CONSTRAINT "postulacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postulacion" ADD CONSTRAINT "postulacion_rol_proyecto_id_fkey" FOREIGN KEY ("rol_proyecto_id") REFERENCES "rol_proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "postulacion" ADD CONSTRAINT "postulacion_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro_equipo" ADD CONSTRAINT "miembro_equipo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro_equipo" ADD CONSTRAINT "miembro_equipo_rol_proyecto_id_fkey" FOREIGN KEY ("rol_proyecto_id") REFERENCES "rol_proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversacion" ADD CONSTRAINT "conversacion_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensaje" ADD CONSTRAINT "mensaje_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensaje" ADD CONSTRAINT "mensaje_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjunto" ADD CONSTRAINT "adjunto_mensaje_id_fkey" FOREIGN KEY ("mensaje_id") REFERENCES "mensaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion_email" ADD CONSTRAINT "notificacion_email_notificacion_id_fkey" FOREIGN KEY ("notificacion_id") REFERENCES "notificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte" ADD CONSTRAINT "reporte_reportante_id_fkey" FOREIGN KEY ("reportante_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporte" ADD CONSTRAINT "reporte_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrega_proyecto" ADD CONSTRAINT "entrega_proyecto_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrega_proyecto" ADD CONSTRAINT "entrega_proyecto_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_insignia" ADD CONSTRAINT "usuario_insignia_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_insignia" ADD CONSTRAINT "usuario_insignia_insignia_id_fkey" FOREIGN KEY ("insignia_id") REFERENCES "insignia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_insignia" ADD CONSTRAINT "usuario_insignia_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token" ADD CONSTRAINT "token_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
