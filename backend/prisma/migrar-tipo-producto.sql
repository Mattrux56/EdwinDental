-- ============================================================================
-- LabTrace · TIPO DE PRODUCTO (Supabase > SQL Editor)
-- Agrega la clasificación BASE / PROTESIS / ADICIONAL a la lista de precios. Fija el orden en las remisiones:
-- primero las bases, luego las prótesis (superiores y después inferiores) y al final los adicionales.
-- Para una base que ya existe; se puede ejecutar más de una vez.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE "TipoProducto" AS ENUM ('BASE', 'PROTESIS', 'ADICIONAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Producto" ADD COLUMN IF NOT EXISTS "tipo" "TipoProducto" NOT NULL DEFAULT 'ADICIONAL';

-- Clasifica los productos que ya existen (sin tildes ni mayúsculas)
UPDATE "Producto" SET "tipo" = CASE
  WHEN translate(lower(btrim("descripcion")), 'áéíóú', 'aeiou') IN ('base semirigida', 'base metalica')
    OR translate(lower(btrim("categoria")), 'áéíóú', 'aeiou') IN ('base semirigida', 'base metalica') THEN 'BASE'::"TipoProducto"
  WHEN translate(lower(btrim("categoria")), 'áéíóú', 'aeiou') LIKE 'protesis%' THEN 'PROTESIS'::"TipoProducto"
  ELSE 'ADICIONAL'::"TipoProducto"
END;
