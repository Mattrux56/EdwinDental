import { Controller, Get, StreamableFile } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const fecha = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');
const fechaHora = (d: Date | null | undefined) => (d ? d.toISOString().replace('T', ' ').slice(0, 16) : '');

function hoja(wb: ExcelJS.Workbook, nombre: string, columnas: { header: string; key: string; width: number }[], filas: object[]) {
  const ws = wb.addWorksheet(nombre);
  ws.columns = columnas;
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  filas.forEach((f) => ws.addRow(f));
}

/** Respaldo completo en un solo Excel: casos, historial, remisiones (con sus líneas), clientes y lista de precios */
@Controller('respaldo')
export class RespaldoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('excel')
  async excel() {
    const [casos, seguimientos, remisiones, clientes, productos] = await Promise.all([
      this.prisma.caso.findMany({ include: { cliente: { select: { nombre: true } } }, orderBy: { id: 'asc' } }),
      this.prisma.seguimiento.findMany({
        include: { caso: { select: { codigo: true } }, _count: { select: { imagenes: true } } },
        orderBy: { id: 'asc' },
      }),
      this.prisma.remision.findMany({
        include: { items: true, caso: { select: { codigo: true, pacienteNombre: true, cliente: { select: { nombre: true } } } } },
        orderBy: { numero: 'asc' },
      }),
      this.prisma.cliente.findMany({ include: { _count: { select: { casos: true } } }, orderBy: { nombre: 'asc' } }),
      this.prisma.producto.findMany({ orderBy: [{ categoria: 'asc' }, { codigo: 'asc' }] }),
    ]);

    const wb = new ExcelJS.Workbook();
    hoja(wb, 'Casos', [
      { header: 'Orden de trabajo', key: 'codigo', width: 20 },
      { header: 'Estado', key: 'estado', width: 16 },
      { header: 'Doctor', key: 'doctor', width: 28 },
      { header: 'Número de factura', key: 'factura', width: 20 },
      { header: 'Cliente', key: 'cliente', width: 30 },
      { header: 'Paciente', key: 'paciente', width: 30 },
      { header: 'Ingreso', key: 'ingreso', width: 12 },
      { header: 'Entrega estimada', key: 'entrega', width: 16 },
      { header: 'Archivado', key: 'archivado', width: 10 },
      { header: 'Creado', key: 'creado', width: 18 },
    ], casos.map((c) => ({
      codigo: c.codigo, estado: c.estado, doctor: c.doctorNombre ?? '', factura: c.numeroFactura ?? '',
      cliente: c.cliente.nombre, paciente: c.pacienteNombre ?? '',
      ingreso: fecha(c.fechaIngreso), entrega: fecha(c.fechaEntregaEstimada), archivado: c.archivado ? 'Sí' : 'No',
      creado: fechaHora(c.creadoEn),
    })));

    hoja(wb, 'Historial', [
      { header: 'Caso', key: 'caso', width: 16 },
      { header: 'Fecha', key: 'fecha', width: 18 },
      { header: 'Tipo', key: 'tipo', width: 14 },
      { header: 'Descripción', key: 'descripcion', width: 70 },
      { header: 'Entrega estimada', key: 'entrega', width: 16 },
      { header: 'Fotos', key: 'fotos', width: 8 },
      { header: 'Registrado por', key: 'por', width: 18 },
    ], seguimientos.map((s) => ({
      caso: s.caso.codigo, fecha: fechaHora(s.creadoEn), tipo: s.tipo, descripcion: s.descripcion,
      entrega: fecha(s.fechaEntregaEstimada), fotos: s._count.imagenes,
    })));

    hoja(wb, 'Remisiones', [
      { header: 'N°', key: 'numero', width: 8 },
      { header: 'Fecha', key: 'fecha', width: 12 },
      { header: 'Caso', key: 'caso', width: 16 },
      { header: 'Doctor / clínica', key: 'doctor', width: 30 },
      { header: 'Paciente', key: 'paciente', width: 30 },
      { header: 'No. orden', key: 'orden', width: 16 },
      { header: 'Total', key: 'total', width: 14 },
      { header: 'Anulada', key: 'anulada', width: 9 },
      { header: 'Pagada', key: 'pagada', width: 9 },
      { header: 'Creada por', key: 'por', width: 18 },
    ], remisiones.map((r) => ({
      numero: r.numero, fecha: fecha(r.fecha), caso: r.caso.codigo, doctor: r.doctorNombre ?? r.caso.cliente.nombre,
      paciente: r.pacienteNombre ?? r.caso.pacienteNombre ?? '', orden: r.noOrden ?? '',
      total: r.items.reduce((a, i) => a + i.cantidad * i.valorUnitario, 0), anulada: r.anulada ? 'Sí' : 'No', pagada: r.pagada ? 'Sí' : 'No',
    })));

    hoja(wb, 'Líneas de remisión', [
      { header: 'N° remisión', key: 'numero', width: 12 },
      { header: 'Cantidad', key: 'cantidad', width: 10 },
      { header: 'Descripción', key: 'descripcion', width: 60 },
      { header: 'Valor unitario', key: 'unitario', width: 14 },
      { header: 'Subtotal', key: 'subtotal', width: 14 },
    ], remisiones.flatMap((r) => r.items.map((i) => ({
      numero: r.numero, cantidad: i.cantidad, descripcion: i.descripcion, unitario: i.valorUnitario, subtotal: i.cantidad * i.valorUnitario,
    }))));

    hoja(wb, 'Clientes', [
      { header: 'Nombre', key: 'nombre', width: 40 },
      { header: 'Casos', key: 'casos', width: 8 },
    ], clientes.map((c) => ({ nombre: c.nombre, casos: c._count.casos })));

    hoja(wb, 'Lista de precios', [
      { header: 'Código', key: 'codigo', width: 10 },
      { header: 'Categoría', key: 'categoria', width: 30 },
      { header: 'Descripción', key: 'descripcion', width: 60 },
      { header: 'Valor', key: 'valor', width: 14 },
      { header: 'Activo', key: 'activo', width: 9 },
    ], productos.map((p) => ({ ...p, activo: p.activo ? 'Sí' : 'No' })));

    const hoy = new Date().toISOString().slice(0, 10);
    return new StreamableFile(Buffer.from(await wb.xlsx.writeBuffer()), {
      type: XLSX,
      disposition: `attachment; filename="respaldo_labtrace_${hoy}.xlsx"`,
    });
  }
}
