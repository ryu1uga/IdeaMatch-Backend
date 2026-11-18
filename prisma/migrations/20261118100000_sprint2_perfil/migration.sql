-- =============================================================================
--  Sprint 2 - Perfil
--   - perfil: headline, ubicación, enlaces y clave de la foto en el almacenamiento
--   - usuario_habilidad: habilidades del usuario (1 a 15, se valida en la API)
--   - usuario_interes: categorías de interés del usuario
-- =============================================================================

-- AlterTable
ALTER TABLE "perfil"
  ADD COLUMN "titular" VARCHAR(100),
  ADD COLUMN "ubicacion" VARCHAR(100),
  ADD COLUMN "foto_key" VARCHAR(255),
  ADD COLUMN "link_portafolio" VARCHAR(500),
  ADD COLUMN "link_linkedin" VARCHAR(500),
  ADD COLUMN "link_github" VARCHAR(500);

-- CreateTable
CREATE TABLE "usuario_habilidad" (
    "usuario_id" BIGINT NOT NULL,
    "habilidad_id" BIGINT NOT NULL,

    CONSTRAINT "usuario_habilidad_pkey" PRIMARY KEY ("usuario_id","habilidad_id")
);

-- CreateTable
CREATE TABLE "usuario_interes" (
    "usuario_id" BIGINT NOT NULL,
    "categoria_id" BIGINT NOT NULL,

    CONSTRAINT "usuario_interes_pkey" PRIMARY KEY ("usuario_id","categoria_id")
);

-- CreateIndex
CREATE INDEX "usuario_habilidad_habilidad_id_idx" ON "usuario_habilidad"("habilidad_id");

-- CreateIndex
CREATE INDEX "usuario_interes_categoria_id_idx" ON "usuario_interes"("categoria_id");

-- AddForeignKey
ALTER TABLE "usuario_habilidad" ADD CONSTRAINT "usuario_habilidad_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_habilidad" ADD CONSTRAINT "usuario_habilidad_habilidad_id_fkey" FOREIGN KEY ("habilidad_id") REFERENCES "habilidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_interes" ADD CONSTRAINT "usuario_interes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_interes" ADD CONSTRAINT "usuario_interes_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
