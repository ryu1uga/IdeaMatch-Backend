-- =============================================================================
--  Verificación de correo y recuperación de contraseña con código de 6 dígitos
--   - token.intentos: intentos fallidos al ingresar el código (se invalida al llegar al máximo)
--   - usuario.estado: las cuentas nuevas empiezan en 'Pendiente_Verificacion'
--     (lo decide la API; el DEFAULT se mantiene en 'Activo' para no afectar a las existentes)
-- =============================================================================

ALTER TABLE "token" ADD COLUMN "intentos" SMALLINT NOT NULL DEFAULT 0;
