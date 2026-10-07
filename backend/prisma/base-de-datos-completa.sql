-- =====================================================================
-- LabTrace · BASE DE DATOS COMPLETA (Supabase > SQL Editor)
-- Crea tablas , índices, llaves foráneas, el bucket de fotos y la lista
-- de precios 2026 (88 productos). Para una base NUEVA / VACÍA.
-- Si ya tienes las tablas, NO lo ejecutes: fallará sin cambiar nada.
-- =====================================================================
BEGIN;

CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Caso" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "pacienteNombre" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'En laboratorio',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaIngreso" DATE,
    "fechaEntregaEstimada" TIMESTAMP(3),
    "precio" DOUBLE PRECISION,
    "archivado" BOOLEAN NOT NULL DEFAULT false,
    "archivadoEn" TIMESTAMP(3),
    "codigoPublico" TEXT,
    CONSTRAINT "Caso_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Seguimiento" (
    "id" SERIAL NOT NULL,
    "casoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'Ingreso Inicial',
    "descripcion" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Seguimiento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CasoImagen" (
    "id" SERIAL NOT NULL,
    "seguimientoId" INTEGER NOT NULL,
    "urlImagen" TEXT NOT NULL,
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CasoImagen_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Producto" (
    "id" SERIAL NOT NULL,
    "codigo" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Remision" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "casoId" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "noOrden" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anulada" BOOLEAN NOT NULL DEFAULT false,
    "anuladaEn" TIMESTAMP(3),
    "pagada" BOOLEAN NOT NULL DEFAULT false,
    "pagadaEn" TIMESTAMP(3),
    "doctorNombre" TEXT,
    "pacienteNombre" TEXT,
    "editadaEn" TIMESTAMP(3),
    CONSTRAINT "Remision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RemisionItem" (
    "id" SERIAL NOT NULL,
    "remisionId" INTEGER NOT NULL,
    "productoId" INTEGER,
    "descripcion" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "valorUnitario" INTEGER NOT NULL,
    CONSTRAINT "RemisionItem_pkey" PRIMARY KEY ("id")
);

-- Índices únicos
CREATE UNIQUE INDEX "Caso_codigo_key" ON "Caso"("codigo");
CREATE UNIQUE INDEX "Producto_codigo_descripcion_key" ON "Producto"("codigo", "descripcion");
CREATE UNIQUE INDEX "Remision_numero_key" ON "Remision"("numero");
CREATE UNIQUE INDEX "Caso_codigoPublico_key" ON "Caso"("codigoPublico");

-- Índices de apoyo en las llaves foráneas
CREATE INDEX "Caso_clienteId_idx" ON "Caso"("clienteId");
CREATE INDEX "Seguimiento_casoId_idx" ON "Seguimiento"("casoId");
CREATE INDEX "CasoImagen_seguimientoId_idx" ON "CasoImagen"("seguimientoId");
CREATE INDEX "Remision_casoId_idx" ON "Remision"("casoId");
CREATE INDEX "Remision_fecha_idx" ON "Remision"("fecha");
CREATE INDEX "RemisionItem_remisionId_idx" ON "RemisionItem"("remisionId");

-- Conexiones (llaves foráneas)
ALTER TABLE "Caso" ADD CONSTRAINT "Caso_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Seguimiento" ADD CONSTRAINT "Seguimiento_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CasoImagen" ADD CONSTRAINT "CasoImagen_seguimientoId_fkey" FOREIGN KEY ("seguimientoId") REFERENCES "Seguimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Remision" ADD CONSTRAINT "Remision_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RemisionItem" ADD CONSTRAINT "RemisionItem_remisionId_fkey" FOREIGN KEY ("remisionId") REFERENCES "Remision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RemisionItem" ADD CONSTRAINT "RemisionItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Bucket público de fotos de los casos (lo usa el backend: 'casos-fotos')
INSERT INTO storage.buckets (id, name, public)
VALUES ('casos-fotos', 'casos-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Permiso para subir, ver y borrar fotos con la clave anon que usa el backend
DROP POLICY IF EXISTS "casos-fotos lectura" ON storage.objects;
DROP POLICY IF EXISTS "casos-fotos subida" ON storage.objects;
DROP POLICY IF EXISTS "casos-fotos borrar" ON storage.objects;
CREATE POLICY "casos-fotos lectura" ON storage.objects FOR SELECT USING (bucket_id = 'casos-fotos');
CREATE POLICY "casos-fotos subida" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'casos-fotos');
CREATE POLICY "casos-fotos borrar" ON storage.objects FOR DELETE USING (bucket_id = 'casos-fotos');

-- Lista de precios 2026 (88 productos)
INSERT INTO "Producto" ("codigo", "categoria", "descripcion", "valor") VALUES
  (1001, 'PROTESIS FIJAS', 'Unidad Metal Porcelana IPS INLINE-VITA', 120000),
  (1002, 'PROTESIS FIJAS', 'Hombro Cerámico vestibular', 50000),
  (1003, 'PROTESIS FIJAS', 'Recargo por unidad sobre implante', 50000),
  (1004, 'PROTESIS FIJAS', 'Colado de UCLA', 50000),
  (1005, 'PROTESIS FIJAS', 'Corona Completa en metal base', 81000),
  (1006, 'PROTESIS FIJAS', 'Corona Telescópica', 60000),
  (1007, 'PROTESIS FIJAS', 'Meryland 1 unidad Metal Porcelana', 190000),
  (1008, 'PROTESIS FIJAS', 'Aplicación de porcela en encias por unidad', 50000),
  (1009, 'PROTESIS FIJAS', 'Aplicación de gingifastpor unidad', 8000),
  (1010, 'PROTESIS FIJAS', 'Aplicación de Porcelana', 70000),
  (1011, 'PROTESIS FIJAS', 'Implan Bridge por implante', 250000),
  (2001, 'CORONA LIBRE DE METAL', 'Corona libre de metal en Zirconio porcelana E.max', 207000),
  (2002, 'CORONA LIBRE DE METAL', 'Unidad en puente fijo libre de metal', 207000),
  (2003, 'CORONA LIBRE DE METAL', 'Corona libre de metal en Disilicato de litio', 207000),
  (2004, 'CORONA LIBRE DE METAL', 'Hombro cerámico', 50000),
  (2005, 'CORONA LIBRE DE METAL', 'Corona Zirconio Multicapa', 250000),
  (2006, 'CORONA LIBRE DE METAL', 'Corona en Disilicato - Monolitico', 225000),
  (2007, 'CORONA LIBRE DE METAL', 'Incrustaciones en Zirconio y Disilicato', 200000),
  (2008, 'CORONA LIBRE DE METAL', 'Carillas en Disilicato', 200000),
  (2009, 'CORONA LIBRE DE METAL', 'Carilla en Disilicato Estratificadas', 225000),
  (2010, 'CORONA LIBRE DE METAL', 'Corona Zirconio – Monolítico', 225000),
  (2011, 'CORONA LIBRE DE METAL', 'Carrillas en ceromero', 80000),
  (2012, 'CORONA LIBRE DE METAL', 'Carrilla en Ceromero Estratificada', 90000),
  (2013, 'CORONA LIBRE DE METAL', 'Espigo en Zirconio', 150000),
  (2014, 'CORONA LIBRE DE METAL', 'Modelo en resina', 30000),
  (2015, 'CORONA LIBRE DE METAL', 'Modelo en resina arcada completa', 60000),
  (3001, 'PROTESIS ACRILICAS', 'Prótesis Total Superior Diente en Acrílico', 135000),
  (3002, 'PROTESIS ACRILICAS', 'Prótesis Total Inferior Diente en Acrílico', 135000),
  (3003, 'PROTESIS ACRILICAS', 'Parcial de 1 a 5 piezas en Acrílico', 94000),
  (3004, 'PROTESIS ACRILICAS', 'Parcial Hasta 7 piezas en Acrílico', 104000),
  (3005, 'PROTESIS ACRILICAS', 'Parcial de 8 piezas en adelante en Acrílico', 135000),
  (3006, 'PROTESIS ACRILICAS', 'Prótesis Total Diente en Duratone', 190000),
  (3007, 'PROTESIS ACRILICAS', 'Prótesis Total Sup. e Inf. Implanto soportada Diente Duratone', 1800000),
  (3008, 'PROTESIS ACRILICAS', 'Parcial de 1 a 5 piezas en Duratone', 127000),
  (3009, 'PROTESIS ACRILICAS', 'Parcial Hasta 7 piezas en Duratone', 166000),
  (3010, 'PROTESIS ACRILICAS', 'Parcial de 8 piezas en adelante en Duratone', 186000),
  (3011, 'PROTESIS ACRILICAS', 'Total inmediata en Acrílico', 135000),
  (3012, 'PROTESIS ACRILICAS', 'Parcial inmediata de 1 a 5 piezas en Acrílica', 94000),
  (3013, 'PROTESIS ACRILICAS', 'Parcial inmediata Hasta 7 piezas en Acrílica', 104000),
  (3014, 'PROTESIS ACRILICAS', 'Parcial inmediata de 8 p. en Acrílico', 135000),
  (3015, 'PROTESIS ACRILICAS', 'Recargo por Paladar Transparente', 45000),
  (3016, 'PROTESIS ACRILICAS', 'Rejilla Wipla', 41000),
  (3017, 'PROTESIS ACRILICAS', 'Rejilla colada', 100000),
  (3018, 'PROTESIS ACRILICAS', 'Cubeta Total en Acrílica', 26000),
  (3019, 'PROTESIS ACRILICAS', 'Cubeta Parcial en Acrílica', 19000),
  (3020, 'PROTESIS ACRILICAS', 'Rodete de Mordida', 19000),
  (3022, 'PROTESIS ACRILICAS', 'Barra Wipla', 41000),
  (3023, 'PROTESIS ACRILICAS', 'Total Acrilica de Alto impacto diente acrilicos', 380000),
  (3024, 'PROTESIS ACRILICAS', 'Total Acrilica de Alto impacto diente duratone', 380000),
  (4001, 'INCRUSTACIONES Y ESPIGOS', 'Espigo Directo en metal N.P.G.', 36000),
  (4002, 'INCRUSTACIONES Y ESPIGOS', 'Espigo indirecto en metal N.P.G.', 46000),
  (4003, 'INCRUSTACIONES Y ESPIGOS', 'Espigo metal base', 26000),
  (4004, 'INCRUSTACIONES Y ESPIGOS', 'Incrustación directa en metal base', 55000),
  (4005, 'INCRUSTACIONES Y ESPIGOS', 'Incrustación indirecta en metal base', 60000),
  (5001, 'AJUSTE DE SEMI-PRESICION', 'Ajuste ERA Sterngold', 0),
  (5002, 'AJUSTE DE SEMI-PRESICION', 'Attachmensts de Rielera Americana', 0),
  (6001, 'JACKET PROVISIONALES', 'Provisionales Autocurado', 20000),
  (6002, 'JACKET PROVISIONALES', 'Provisionales Termocurado', 22000),
  (6003, 'JACKET PROVISIONALES', 'Provisionales con Alas', 25000),
  (7001, 'PROTESIS REMOVIBLE', 'Base Metálica para C.A. ó T.M. Inf.', 197000),
  (7002, 'PROTESIS REMOVIBLE', 'Base Metálica para AKERS', 100000),
  (7003, 'PROTESIS REMOVIBLE', 'Pieza en acrílico a remplazar', 22000),
  (7004, 'PROTESIS REMOVIBLE', 'Pieza en Duratone a remplazar', 33000),
  (7005, 'PROTESIS REMOVIBLE', 'Gancho Wipla', 29000),
  (8001, 'PROTESIS SEMIRRIGIDAS', 'Base semirrígida para P.P.R.', 239000),
  (8002, 'PROTESIS SEMIRRIGIDAS', 'Base semirrígida para Akers', 152000),
  (8003, 'PROTESIS SEMIRRIGIDAS', 'Piezas en Acrílico a reemplazar', 22000),
  (8004, 'PROTESIS SEMIRRIGIDAS', 'Piezas en Duratones a reemplazar', 33000),
  (8004, 'PROTESIS SEMIRRIGIDAS', 'Piezas en Ivostar Gnathotar a reemplazar', 33000),
  (9001, 'VARIOS', 'Encerado de Diagnostico por unidad', 16500),
  (9002, 'VARIOS', 'Vaciado de impresión en yeso', 19800),
  (9003, 'VARIOS', 'Montaje en articulador Whip Mix en yeso', 22000),
  (9004, 'VARIOS', 'Guías Quirúrgicas para Implante en Acrilico', 71500),
  (9005, 'VARIOS', 'Placa Miorelajante', 45000),
  (9006, 'VARIOS', 'Funda de Blanqueamiento', 45000),
  (9007, 'VARIOS', 'Estructura para prótesiss hibridas por implante (No incluye Ucla)', 720000),
  (9008, 'VARIOS', 'Cambio de piezas', 30000),
  (9009, 'VARIOS', 'Elaboracion de Estructura por unidad', 60000),
  (9010, 'VARIOS', 'Triturante metalica', 30000),
  (9011, 'VARIOS', 'Asistencia Tecnica', 40000),
  (9012, 'VARIOS', 'Refuerzo metalico a parcial acrilica', 31000),
  (10001, 'REPARACIONES', 'Agregar cajuela a removible', 70000),
  (10002, 'REPARACIONES', 'Agregar gancho a Removible', 66000),
  (10003, 'REPARACIONES', 'Agregar pieza a un prótesis total CA ó TM', 66000),
  (10004, 'REPARACIONES', 'Reparar prótesis total en acrílico', 55000),
  (10005, 'REPARACIONES', 'Rebasar prótesis total en acrílico', 60500),
  (10006, 'REPARACIONES', 'Reparción de protesis', 120000),
  (10007, 'REPARACIONES', 'Limpieza de Protesis', 120000);

COMMIT;
