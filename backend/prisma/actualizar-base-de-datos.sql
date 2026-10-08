-- =====================================================================
-- LabTrace · actualización de base existente (fechas por seguimiento, datos de orden/factura,
-- archivar casos, enlace público seguro, copia de nombres en remisiones,
-- pago por remisión e índices)
-- Pegar completo en Supabase → SQL Editor → Run.
-- Para una base existente de LabTrace; no es un instalador para una base vacía.
-- Se puede ejecutar varias veces.
-- =====================================================================
BEGIN;

-- ---- Limpieza: el sistema de usuarios ya no existe (si no estaba, no pasa nada)
DROP TABLE IF EXISTS "Usuario";
ALTER TABLE "Caso" DROP COLUMN IF EXISTS "creadoPor";
ALTER TABLE "Seguimiento" DROP COLUMN IF EXISTS "creadoPor";
ALTER TABLE "Remision" DROP COLUMN IF EXISTS "creadoPor";

-- ---- Casos: archivado y código público aleatorio
-- Columnas que el programa ya no usa
ALTER TABLE "Caso" DROP COLUMN IF EXISTS "titulo";
ALTER TABLE "Caso" DROP COLUMN IF EXISTS "precio";
ALTER TABLE "Caso" ADD COLUMN IF NOT EXISTS "doctorNombre" TEXT;
ALTER TABLE "Caso" ADD COLUMN IF NOT EXISTS "numeroFactura" TEXT;
ALTER TABLE "Seguimiento" ADD COLUMN IF NOT EXISTS "fechaEntregaEstimada" DATE;

-- Mantiene la fecha vigente de cada caso en su seguimiento más reciente
UPDATE "Seguimiento" s
SET "fechaEntregaEstimada" = c."fechaEntregaEstimada"::date
FROM "Caso" c
WHERE s."casoId" = c."id"
  AND c."fechaEntregaEstimada" IS NOT NULL
  AND s."fechaEntregaEstimada" IS NULL
  AND s."id" = (
    SELECT s2."id"
    FROM "Seguimiento" s2
    WHERE s2."casoId" = c."id"
    ORDER BY s2."creadoEn" DESC, s2."id" DESC
    LIMIT 1
  );

ALTER TABLE "Caso" ADD COLUMN IF NOT EXISTS "archivado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Caso" ADD COLUMN IF NOT EXISTS "archivadoEn" TIMESTAMP(3);
ALTER TABLE "Caso" ADD COLUMN IF NOT EXISTS "codigoPublico" TEXT;

-- Los casos que ya existen reciben su código público aleatorio
UPDATE "Caso"
SET "codigoPublico" = substr(md5(random()::text || clock_timestamp()::text || "id"::text), 1, 12)
WHERE "codigoPublico" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Caso_codigoPublico_key" ON "Caso"("codigoPublico");

-- ---- Remisiones: copia de los nombres al emitirla y fecha de edición
ALTER TABLE "Remision" ADD COLUMN IF NOT EXISTS "doctorNombre" TEXT;
ALTER TABLE "Remision" ADD COLUMN IF NOT EXISTS "pacienteNombre" TEXT;
ALTER TABLE "Remision" ADD COLUMN IF NOT EXISTS "editadaEn" TIMESTAMP(3);

-- Las remisiones ya emitidas guardan los nombres actuales del caso
UPDATE "Remision" r
SET "doctorNombre" = cl."nombre",
    "pacienteNombre" = c."pacienteNombre"
FROM "Caso" c
JOIN "Cliente" cl ON cl."id" = c."clienteId"
WHERE r."casoId" = c."id" AND r."doctorNombre" IS NULL;

-- ---- Cuentas de cobro: el pago se marca por remisión
ALTER TABLE "Remision" ADD COLUMN IF NOT EXISTS "pagada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Remision" ADD COLUMN IF NOT EXISTS "pagadaEn" TIMESTAMP(3);

-- Si había cuentas marcadas como pagadas (versión anterior), sus remisiones pasan a pagadas
DO $$ BEGIN
  IF to_regclass('public."CuentaCobro"') IS NOT NULL THEN
    UPDATE "Remision" r
    SET "pagada" = true, "pagadaEn" = cc."pagadaEn"
    FROM "Caso" c
    JOIN "CuentaCobro" cc ON cc."clienteId" = c."clienteId" AND cc."pagada" = true
    WHERE r."casoId" = c."id"
      AND r."anulada" = false
      AND cc."anio" = EXTRACT(YEAR FROM r."fecha")::int
      AND cc."mes" = EXTRACT(MONTH FROM r."fecha")::int;
  END IF;
END $$;
DROP TABLE IF EXISTS "CuentaCobro";

-- ---- Clientes: el documento / NIT ya no se usa
ALTER TABLE "Cliente" DROP COLUMN IF EXISTS "documentoIdentidad";

-- ---- Índices en las llaves foráneas (listas más rápidas al crecer los datos)
CREATE INDEX IF NOT EXISTS "Caso_clienteId_idx" ON "Caso"("clienteId");
CREATE INDEX IF NOT EXISTS "Seguimiento_casoId_idx" ON "Seguimiento"("casoId");
CREATE INDEX IF NOT EXISTS "CasoImagen_seguimientoId_idx" ON "CasoImagen"("seguimientoId");
CREATE INDEX IF NOT EXISTS "Remision_casoId_idx" ON "Remision"("casoId");
CREATE INDEX IF NOT EXISTS "Remision_fecha_idx" ON "Remision"("fecha");
CREATE INDEX IF NOT EXISTS "RemisionItem_remisionId_idx" ON "RemisionItem"("remisionId");

-- ---- Storage: permitir borrar fotos desde la aplicación (solo si no existe ya la política)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'casos-fotos borrar'
  ) THEN
    CREATE POLICY "casos-fotos borrar" ON storage.objects FOR DELETE USING (bucket_id = 'casos-fotos');
  END IF;
END $$;

COMMIT;
