import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export function validarPeriodo(anio: number, mes: number) {
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) throw new BadRequestException('El año no es válido');
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) throw new BadRequestException('El mes no es válido');
}

const rango = (anio: number, mes: number) => ({
  gte: new Date(Date.UTC(anio, mes - 1, 1)),
  lt: new Date(Date.UTC(anio, mes, 1)),
});

/**
 * Cuenta de cobro = remisiones (no anuladas) de un cliente en un mes.
 * Los totales se calculan con las remisiones y el pago se marca en cada remisión:
 * la cuenta está «pagada» cuando todas sus remisiones lo están.
 */
@Injectable()
export class CuentasCobroService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(anio: number, mes: number) {
    validarPeriodo(anio, mes);
    const remisiones = await this.prisma.remision.findMany({
      where: { anulada: false, fecha: rango(anio, mes) },
      include: {
        items: true,
        caso: { select: { codigo: true, pacienteNombre: true, cliente: { select: { id: true, nombre: true } } } },
      },
      orderBy: { numero: 'asc' },
    });

    const grupos = new Map<number, { clienteId: number; cliente: string; remisiones: ReturnType<CuentasCobroService['linea']>[] }>();
    for (const r of remisiones) {
      const c = r.caso.cliente;
      if (!grupos.has(c.id)) grupos.set(c.id, { clienteId: c.id, cliente: c.nombre, remisiones: [] });
      grupos.get(c.id)!.remisiones.push(this.linea(r));
    }
    return [...grupos.values()]
      .map((g) => {
        const total = g.remisiones.reduce((a, l) => a + l.total, 0);
        const pagado = g.remisiones.filter((l) => l.pagada).reduce((a, l) => a + l.total, 0);
        const pagadas = g.remisiones.filter((l) => l.pagada).length;
        return {
          ...g,
          total,
          totalPagado: pagado,
          pagadas,
          pagada: pagadas === g.remisiones.length,
        };
      })
      .sort((a, b) => a.cliente.localeCompare(b.cliente, 'es'));
  }

  /** Marca (o desmarca) como pagadas todas las remisiones vigentes de un cliente en el mes */
  async marcarCuenta(clienteId: number, anio: number, mes: number, pagada: boolean) {
    validarPeriodo(anio, mes);
    const cliente = await this.prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } });
    if (!cliente) throw new NotFoundException(`El cliente #${clienteId} no existe`);
    const r = await this.prisma.remision.updateMany({
      where: { anulada: false, fecha: rango(anio, mes), caso: { clienteId } },
      data: { pagada, pagadaEn: pagada ? new Date() : null },
    });
    if (r.count === 0) throw new BadRequestException('Ese cliente no tiene remisiones vigentes en el periodo');
    return { remisiones: r.count, pagada };
  }

  private linea(r: {
    id: number;
    numero: number;
    fecha: Date;
    noOrden: string | null;
    pacienteNombre: string | null;
    pagada: boolean;
    pagadaEn: Date | null;
    items: { cantidad: number; valorUnitario: number }[];
    caso: { pacienteNombre: string | null };
  }) {
    return {
      id: r.id,
      numero: r.numero,
      fecha: r.fecha,
      noOrden: r.noOrden,
      paciente: r.pacienteNombre ?? r.caso.pacienteNombre,
      total: r.items.reduce((acc, i) => acc + i.cantidad * i.valorUnitario, 0),
      pagada: r.pagada,
      pagadaEn: r.pagadaEn,
    };
  }
}
