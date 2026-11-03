-- =====================================================================
-- LabTrace · OPTIMIZACIÓN DE CONSULTAS (Supabase > SQL Editor)
-- Para una base que YA tiene datos. Se puede ejecutar más de una vez sin problema.
--  1) Índices de apoyo a los listados, alertas y cuentas de cobro.
--  2) Búsqueda rápida (pg_trgm) por orden, doctor, paciente y cliente.
--  3) Estados antiguos ("En Proceso", mayúsculas distintas) al nombre actual.
-- =====================================================================

-- 1) Índices
CREATE INDEX IF NOT EXISTS "Caso_archivado_creadoEn_idx" ON "Caso"("archivado", "creadoEn");
CREATE INDEX IF NOT EXISTS "Caso_archivado_estado_idx" ON "Caso"("archivado", "estado");
CREATE INDEX IF NOT EXISTS "Caso_fechaEntregaEstimada_idx" ON "Caso"("fechaEntregaEstimada");
CREATE INDEX IF NOT EXISTS "Seguimiento_casoId_creadoEn_idx" ON "Seguimiento"("casoId", "creadoEn");
CREATE INDEX IF NOT EXISTS "Remision_anulada_fecha_idx" ON "Remision"("anulada", "fecha");

-- 2) Búsqueda con ILIKE '%texto%'
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "Caso_codigo_trgm_idx" ON "Caso" USING GIN ("codigo" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Caso_doctorNombre_trgm_idx" ON "Caso" USING GIN ("doctorNombre" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Caso_pacienteNombre_trgm_idx" ON "Caso" USING GIN ("pacienteNombre" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Cliente_nombre_trgm_idx" ON "Cliente" USING GIN ("nombre" gin_trgm_ops);

-- 3) Estados con el nombre actual
UPDATE "Caso" SET "estado" = 'En prueba' WHERE lower("estado") = 'en proceso';
UPDATE "Caso" SET "estado" = 'En laboratorio' WHERE lower("estado") = 'en laboratorio' AND "estado" <> 'En laboratorio';
UPDATE "Caso" SET "estado" = 'Finalizado' WHERE lower("estado") = 'finalizado' AND "estado" <> 'Finalizado';
UPDATE "Caso" SET "estado" = 'arreglo' WHERE lower("estado") = 'arreglo' AND "estado" <> 'arreglo';
UPDATE "Caso" SET "estado" = 'Devolución' WHERE lower("estado") IN ('devolución', 'devolucion') AND "estado" <> 'Devolución';
