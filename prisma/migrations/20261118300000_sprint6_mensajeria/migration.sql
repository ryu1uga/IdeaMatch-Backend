-- =============================================================================
--  Sprint 6 - Equipo y mensajería
--   - adjunto: nombre original del archivo
--   - conversacion_lectura: última lectura de cada usuario (no leídos / "visto")
--   - una conversación por cada proyecto ya publicado
-- =============================================================================

-- AlterTable
ALTER TABLE "adjunto" ADD COLUMN "nombre" VARCHAR(255);

-- CreateTable
CREATE TABLE "conversacion_lectura" (
    "conversacion_id" BIGINT NOT NULL,
    "usuario_id" BIGINT NOT NULL,
    "ultima_lectura" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversacion_lectura_pkey" PRIMARY KEY ("conversacion_id","usuario_id")
);

-- CreateIndex
CREATE INDEX "conversacion_lectura_usuario_id_idx" ON "conversacion_lectura"("usuario_id");

-- AddForeignKey
ALTER TABLE "conversacion_lectura" ADD CONSTRAINT "conversacion_lectura_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversacion_lectura" ADD CONSTRAINT "conversacion_lectura_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Conversación para los proyectos publicados que aún no la tienen
INSERT INTO "conversacion" ("proyecto_id")
SELECT p."id" FROM "proyecto" p
WHERE p."estado" <> 'Borrador'
  AND NOT EXISTS (SELECT 1 FROM "conversacion" c WHERE c."proyecto_id" = p."id");
