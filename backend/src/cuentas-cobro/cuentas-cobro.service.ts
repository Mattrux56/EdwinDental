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
        caso: {
          select: {
            codigo: true,
            pacienteNombre: true,
            doctorNombre: true,
            cliente: { select: { id: true, nombre: true } },
          },
        },
      },
      orderBy: [{ numero: 'asc' }, { tipo: 'asc' }],
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

  /**
   * Guarda el estado de pago de las remisiones vigentes de un cliente en el mes:
   * las que vienen en `pagadas` quedan pagadas y todas las demás pendientes.
   */
  async guardarPagos(clienteId: number, anio: number, mes: number, pagadas: number[]) {
    validarPeriodo(anio, mes);
    const cliente = await this.prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } });
    if (!cliente) throw new NotFoundException(`El cliente #${clienteId} no existe`);
    const vigentes = await this.prisma.remision.findMany({
      where: { anulada: false, fecha: rango(anio, mes), caso: { clienteId } },
      select: { id: true, pagada: true },
    });
    if (vigentes.length === 0) throw new BadRequestException('Ese cliente no tiene remisiones vigentes en el periodo');
    const validas = new Set(vigentes.map((r) => r.id));
    if (pagadas.some((id) => !validas.has(id))) {
      throw new BadRequestException('Hay remisiones que no pertenecen a esta cuenta de cobro');
    }
    const marcar = new Set(pagadas);
    const aPagar = vigentes.filter((r) => marcar.has(r.id) && !r.pagada).map((r) => r.id);
    const aPendiente = vigentes.filter((r) => !marcar.has(r.id) && r.pagada).map((r) => r.id);
    await this.prisma.$transaction([
      this.prisma.remision.updateMany({ where: { id: { in: aPagar } }, data: { pagada: true, pagadaEn: new Date() } }),
      this.prisma.remision.updateMany({ where: { id: { in: aPendiente } }, data: { pagada: false, pagadaEn: null } }),
    ]);
    return { pagadas: marcar.size, pendientes: vigentes.length - marcar.size };
  }

  private linea(r: {
    id: number;
    numero: number;
    tipo: string;
    fecha: Date;
    noOrden: string | null;
    pacienteNombre: string | null;
    doctorNombre: string | null;
    pagada: boolean;
    pagadaEn: Date | null;
    items: { cantidad: number; valorUnitario: number }[];
    caso: {
      pacienteNombre: string | null;
      doctorNombre: string | null;
      codigo: string;
    };
  }) {
    return {
      id: r.id,
      numero: r.numero,
      tipo: r.tipo,
      fecha: r.fecha,
      noOrden: r.noOrden,
      doctor: r.doctorNombre ?? r.caso.doctorNombre,
      ordenTrabajo: r.caso.codigo,
      paciente: r.pacienteNombre ?? r.caso.pacienteNombre,
      total: r.items.reduce((acc, i) => acc + i.cantidad * i.valorUnitario, 0),
      pagada: r.pagada,
      pagadaEn: r.pagadaEn,
    };
  }
}
