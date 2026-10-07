-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "Seguimiento" (
    "id" SERIAL NOT NULL,
    "casoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'Ingreso Inicial',
    "descripcion" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Seguimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasoImagen" (
    "id" SERIAL NOT NULL,
    "seguimientoId" INTEGER NOT NULL,
    "urlImagen" TEXT NOT NULL,
    "subidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CasoImagen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "RemisionItem" (
    "id" SERIAL NOT NULL,
    "remisionId" INTEGER NOT NULL,
    "productoId" INTEGER,
    "descripcion" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "valorUnitario" INTEGER NOT NULL,

    CONSTRAINT "RemisionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex

-- CreateIndex
CREATE UNIQUE INDEX "Caso_codigo_key" ON "Caso"("codigo");

-- AddForeignKey
ALTER TABLE "Caso" ADD CONSTRAINT "Caso_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seguimiento" ADD CONSTRAINT "Seguimiento_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasoImagen" ADD CONSTRAINT "CasoImagen_seguimientoId_fkey" FOREIGN KEY ("seguimientoId") REFERENCES "Seguimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigo_descripcion_key" ON "Producto"("codigo", "descripcion");

-- CreateIndex
CREATE UNIQUE INDEX "Remision_numero_key" ON "Remision"("numero");

-- AddForeignKey
ALTER TABLE "Remision" ADD CONSTRAINT "Remision_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemisionItem" ADD CONSTRAINT "RemisionItem_remisionId_fkey" FOREIGN KEY ("remisionId") REFERENCES "Remision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemisionItem" ADD CONSTRAINT "RemisionItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "Caso_codigoPublico_key" ON "Caso"("codigoPublico");
CREATE INDEX "Caso_clienteId_idx" ON "Caso"("clienteId");
CREATE INDEX "Seguimiento_casoId_idx" ON "Seguimiento"("casoId");
CREATE INDEX "CasoImagen_seguimientoId_idx" ON "CasoImagen"("seguimientoId");
CREATE INDEX "Remision_casoId_idx" ON "Remision"("casoId");
CREATE INDEX "Remision_fecha_idx" ON "Remision"("fecha");
CREATE INDEX "RemisionItem_remisionId_idx" ON "RemisionItem"("remisionId");

-- AddForeignKey
