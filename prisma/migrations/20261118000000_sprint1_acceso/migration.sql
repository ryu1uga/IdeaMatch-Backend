-- =============================================================================
--  Sprint 1 - Acceso
--   - usuario: nombres / apellidos (firstName / lastName) y es_admin
--   - usuario: sin servicio de correo la cuenta queda 'Activo' al registrarse
--   - token_revocado: lista negra de JWT para POST /auth/logout
-- =============================================================================

-- AlterTable: columnas nuevas (con default temporal para filas existentes)
ALTER TABLE "usuario"
  ADD COLUMN "nombres" VARCHAR(60) NOT NULL DEFAULT '',
  ADD COLUMN "apellidos" VARCHAR(60) NOT NULL DEFAULT '',
  ADD COLUMN "es_admin" BOOLEAN NOT NULL DEFAULT false;

-- Rellena nombres/apellidos a partir del nombre visible del perfil
UPDATE "usuario" u
SET "nombres"   = LEFT(split_part(p."nombre_visible", ' ', 1), 60),
    "apellidos" = LEFT(btrim(substr(p."nombre_visible", length(split_part(p."nombre_visible", ' ', 1)) + 1)), 60)
FROM "perfil" p
WHERE p."usuario_id" = u."id";

ALTER TABLE "usuario"
  ALTER COLUMN "nombres" DROP DEFAULT,
  ALTER COLUMN "apellidos" DROP DEFAULT,
  ALTER COLUMN "rol_global" SET DEFAULT 'Colaborador',
  ALTER COLUMN "estado" SET DEFAULT 'Activo';

-- Nuevo estado 'Activo'
ALTER TABLE "usuario" DROP CONSTRAINT "usuario_estado_ck";
ALTER TABLE "usuario"
  ADD CONSTRAINT "usuario_estado_ck"
    CHECK ("estado" IN ('Activo','Pendiente_Verificacion','Verificado','Suspendido','Baja'));

-- Las cuentas que esperaban verificación quedan activas (ya no hay correo)
UPDATE "usuario" SET "estado" = 'Activo' WHERE "estado" IN ('Pendiente_Verificacion', 'Verificado');

-- CreateTable
CREATE TABLE "token_revocado" (
    "jti" VARCHAR(64) NOT NULL,
    "usuario_id" BIGINT NOT NULL,
    "expira_en" TIMESTAMPTZ NOT NULL,
    "fecha" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_revocado_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE INDEX "token_revocado_expira_en_idx" ON "token_revocado"("expira_en");

-- CreateIndex
CREATE INDEX "token_revocado_usuario_id_idx" ON "token_revocado"("usuario_id");

-- AddForeignKey
ALTER TABLE "token_revocado" ADD CONSTRAINT "token_revocado_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
