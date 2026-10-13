-- Migración para bases existentes (Supabase > SQL Editor).
-- Agrega la serie de remisiones, mantiene todas las remisiones previas como normales
-- elimina el dato de factura que ya no se utiliza y activa RLS en todas las tablas.
-- Se puede ejecutar más de una vez.
BEGIN;

ALTER TABLE "Remision"
    ADD COLUMN IF NOT EXISTS "tipo" TEXT NOT NULL DEFAULT 'NORMAL';

UPDATE "Remision"
SET "tipo" = 'NORMAL'
WHERE "tipo" IS NULL OR "tipo" NOT IN ('NORMAL', 'ELECTRONICA');

ALTER TABLE "Remision"
    ALTER COLUMN "tipo" SET DEFAULT 'NORMAL',
    ALTER COLUMN "tipo" SET NOT NULL;

ALTER TABLE "Caso"
    DROP COLUMN IF EXISTS "numeroFactura";

-- Libera la numeración global anterior; la nueva clave separa ambas series.
ALTER TABLE "Remision"
    DROP CONSTRAINT IF EXISTS "Remision_numero_key";
DROP INDEX IF EXISTS "Remision_numero_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Remision_tipo_numero_key"
    ON "Remision" ("tipo", "numero");

-- Seguridad: con RLS activo y sin políticas, nadie entra a las tablas por la Data API de Supabase
-- (URL + anon key). La aplicación no se ve afectada: se conecta directo a la base con Prisma.
ALTER TABLE "Cliente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Caso" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Seguimiento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CasoImagen" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Producto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Remision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RemisionItem" ENABLE ROW LEVEL SECURITY;

COMMIT;
