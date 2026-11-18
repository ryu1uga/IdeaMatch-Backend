-- =============================================================================
--  Sprint 3 - Proyectos
--   - proyecto: estado 'Borrador' (por defecto), modalidad, fecha_creacion;
--     resumen y fecha_publicacion pasan a ser opcionales (se exigen al publicar)
--   - rol_proyecto: dedicación y descripción
--   - rol_habilidad: habilidades requeridas por cada rol
-- =============================================================================

-- AlterTable proyecto
ALTER TABLE "proyecto"
  ADD COLUMN "modalidad" VARCHAR(20),
  ADD COLUMN "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "resumen" DROP NOT NULL,
  ALTER COLUMN "estado" SET DEFAULT 'Borrador',
  ALTER COLUMN "fecha_publicacion" DROP NOT NULL,
  ALTER COLUMN "fecha_publicacion" DROP DEFAULT;

-- Los proyectos existentes se crearon al publicarse
UPDATE "proyecto" SET "fecha_creacion" = "fecha_publicacion" WHERE "fecha_publicacion" IS NOT NULL;

ALTER TABLE "proyecto" DROP CONSTRAINT "proyecto_estado_ck";
ALTER TABLE "proyecto"
  ADD CONSTRAINT "proyecto_estado_ck"
    CHECK ("estado" IN ('Borrador','Abierto','En_Curso','Pausado','Cerrado','Cancelado')),
  ADD CONSTRAINT "proyecto_modalidad_ck"
    CHECK ("modalidad" IS NULL OR "modalidad" IN ('Remoto','Presencial','Hibrido'));

-- AlterTable rol_proyecto (default temporal para filas existentes)
ALTER TABLE "rol_proyecto"
  ADD COLUMN "descripcion" TEXT,
  ADD COLUMN "dedicacion" VARCHAR(10) NOT NULL DEFAULT '5-10';
ALTER TABLE "rol_proyecto" ALTER COLUMN "dedicacion" DROP DEFAULT;
ALTER TABLE "rol_proyecto"
  ADD CONSTRAINT "rol_proyecto_dedicacion_ck"
    CHECK ("dedicacion" IN ('5-10','10-20','20+'));

-- CreateTable
CREATE TABLE "rol_habilidad" (
    "rol_proyecto_id" BIGINT NOT NULL,
    "habilidad_id" BIGINT NOT NULL,

    CONSTRAINT "rol_habilidad_pkey" PRIMARY KEY ("rol_proyecto_id","habilidad_id")
);

-- CreateIndex
CREATE INDEX "rol_habilidad_habilidad_id_idx" ON "rol_habilidad"("habilidad_id");

-- AddForeignKey
ALTER TABLE "rol_habilidad" ADD CONSTRAINT "rol_habilidad_rol_proyecto_id_fkey" FOREIGN KEY ("rol_proyecto_id") REFERENCES "rol_proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_habilidad" ADD CONSTRAINT "rol_habilidad_habilidad_id_fkey" FOREIGN KEY ("habilidad_id") REFERENCES "habilidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
