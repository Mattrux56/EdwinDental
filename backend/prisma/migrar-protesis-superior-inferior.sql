-- =====================================================================
-- LabTrace · Prótesis superiores e inferiores en las remisiones (Supabase > SQL Editor)
-- Para una base que YA tiene las tablas. Se puede ejecutar más de una vez.
-- Las líneas anteriores quedan en 0 / 0; solo las prótesis nuevas (o corregidas) guardan el reparto.
-- Con `npm run prisma:push` se obtiene el mismo resultado.
-- =====================================================================
ALTER TABLE "RemisionItem" ADD COLUMN IF NOT EXISTS "cantidadSuperior" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RemisionItem" ADD COLUMN IF NOT EXISTS "cantidadInferior" INTEGER NOT NULL DEFAULT 0;
