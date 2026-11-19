-- =============================================================================
--  Sprint 8 - Administración
--   - proyecto: estado 'Suspendido' (un admin lo pone al resolver un reporte)
-- =============================================================================

ALTER TABLE "proyecto" DROP CONSTRAINT "proyecto_estado_ck";
ALTER TABLE "proyecto"
  ADD CONSTRAINT "proyecto_estado_ck"
    CHECK ("estado" IN ('Borrador','Abierto','En_Curso','Pausado','Cerrado','Cancelado','Suspendido'));
