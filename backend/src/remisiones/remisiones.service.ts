import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { dateOnlyToUtc, todayLocal } from '../common/date-only';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRemisionDto, TipoRemision } from './dto/create-remision.dto';
import { UpdateRemisionDto } from './dto/update-remision.dto';
import { generarRemisionExcel } from './remision-excel';

const REMISION_INCLUDE = {
  caso: {
    select: {
      id: true,
      codigo: true,
      doctorNombre: true,
      pacienteNombre: true,
      cliente: { select: { id: true, nombre: true } },
    },
  },
  items: { orderBy: { id: 'asc' } },
} satisfies Prisma.RemisionInclude;

type RemisionConItems = Prisma.RemisionGetPayload<{ include: typeof REMISION_INCLUDE }>;
const MAX_NUMERO_REMISION = 2147483647;

@Injectable()
export class RemisionesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(casoId?: number) {
    const remisiones = await this.prisma.remision.findMany({
      where: casoId ? { casoId } : undefined,
      include: REMISION_INCLUDE,
      orderBy: [{ numero: 'desc' }, { tipo: 'asc' }],
    });
    return remisiones.map((r) => this.withTotal(r));
  }

  async findOne(id: number) {
    return this.withTotal(await this.getOrFail(id));
  }

  async siguienteNumero(tipo: TipoRemision = TipoRemision.NORMAL) {
    return { siguiente: await this.nextNumero(tipo) };
  }

  async create(dto: CreateRemisionDto) {
    const caso = await this.prisma.caso.findUnique({
      where: { id: dto.casoId },
      select: { id: true, codigo: true, pacienteNombre: true, doctorNombre: true, cliente: { select: { nombre: true } } },
    });
    if (!caso) throw new NotFoundException(`El caso #${dto.casoId} no existe`);

    const ids = dto.items.map((i) => i.productoId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Hay productos repetidos en la remisión');
    }
    const productos = await this.prisma.producto.findMany({
      where: { id: { in: ids }, activo: true },
    });
    if (productos.length !== ids.length) {
      throw new BadRequestException('Uno o más productos no existen o están inactivos');
    }
    const sinPrecio = productos.find((p) => p.valor <= 0);
    if (sinPrecio) {
      throw new BadRequestException(`El producto "${sinPrecio.descripcion}" no tiene precio en la lista`);
    }
    const porId = new Map(productos.map((p) => [p.id, p]));

    const tipo = dto.tipo ?? TipoRemision.NORMAL;
    const numero = dto.numero ?? await this.nextNumero(tipo);
    if (numero === null) {
      throw new BadRequestException(
        await this.prisma.remision.count({ where: { tipo } }) === 0
          ? `Indica el número de la primera remisión ${tipo === TipoRemision.ELECTRONICA ? 'electrónica' : 'normal'}`
          : 'No hay números de remisión disponibles',
      );
    }
    const existing = await this.prisma.remision.findUnique({
      where: { tipo_numero: { tipo, numero } },
      select: { id: true },
    });
    if (existing) throw this.numeroDuplicado(numero, tipo);

    try {
      const creada = await this.prisma.remision.create({
        data: {
          numero,
          tipo,
          casoId: caso.id,
          fecha: dateOnlyToUtc(dto.fecha ?? todayLocal()),
          noOrden: dto.noOrden?.trim() || caso.codigo,
          // Copia de los nombres: si luego se edita o fusiona el cliente, esta remisión no cambia
          doctorNombre: caso.doctorNombre ?? caso.cliente.nombre,
          pacienteNombre: caso.pacienteNombre,
          items: {
            create: dto.items.map((item) => {
              const p = porId.get(item.productoId)!;
              return {
                productoId: p.id,
                descripcion: p.descripcion,
                cantidad: item.cantidad,
                valorUnitario: p.valor,
              };
            }),
          },
        },
        include: REMISION_INCLUDE,
      });
      return this.withTotal(creada);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        String(error.meta?.target).includes('tipo') &&
        String(error.meta?.target).includes('numero')
      ) {
        throw this.numeroDuplicado(numero, tipo);
      }
      throw error;
    }
  }

  /**
   * Corrige una remisión: tipo, número, fecha, orden, nombres impresos y productos/cantidades.
   * Los productos que ya estaban conservan su precio original; los nuevos toman el precio vigente de la lista.
   * Una remisión anulada no se edita.
   */
  async update(id: number, dto: UpdateRemisionDto) {
    const actual = await this.getOrFail(id);
    if (actual.anulada) throw new BadRequestException('Una remisión anulada no se puede editar');

    const tipo = dto.tipo ?? actual.tipo as TipoRemision;
    const numero = dto.numero ?? actual.numero;
    const existente = await this.prisma.remision.findUnique({
      where: { tipo_numero: { tipo, numero } },
      select: { id: true },
    });
    if (existente && existente.id !== id) throw this.numeroDuplicado(numero, tipo);

    const data: Prisma.RemisionUpdateInput = { editadaEn: new Date() };
    if (dto.tipo !== undefined) data.tipo = tipo;
    if (dto.numero !== undefined) data.numero = numero;
    if (dto.fecha !== undefined) data.fecha = dateOnlyToUtc(dto.fecha);
    if (dto.noOrden !== undefined) data.noOrden = dto.noOrden.trim() || actual.caso.codigo;
    if (dto.doctorNombre !== undefined) data.doctorNombre = dto.doctorNombre.trim() || null;
    if (dto.pacienteNombre !== undefined) data.pacienteNombre = dto.pacienteNombre.trim() || null;

    let nuevasLineas: Prisma.RemisionItemCreateManyInput[] | null = null;
    if (dto.items) {
      const ids = dto.items.map((i) => i.productoId);
      if (new Set(ids).size !== ids.length) throw new BadRequestException('Hay productos repetidos en la remisión');
      const previos = new Map(actual.items.filter((i) => i.productoId !== null).map((i) => [i.productoId as number, i]));
      const nuevosIds = ids.filter((pid) => !previos.has(pid));
      const productos = nuevosIds.length
        ? await this.prisma.producto.findMany({ where: { id: { in: nuevosIds }, activo: true } })
        : [];
      if (productos.length !== nuevosIds.length) {
        throw new BadRequestException('Uno o más productos no existen o están inactivos');
      }
      const sinPrecio = productos.find((p) => p.valor <= 0);
      if (sinPrecio) throw new BadRequestException(`El producto "${sinPrecio.descripcion}" no tiene precio en la lista`);
      const porId = new Map(productos.map((p) => [p.id, p]));
      nuevasLineas = dto.items.map((item) => {
        const previo = previos.get(item.productoId);
        const p = porId.get(item.productoId);
        return {
          remisionId: id,
          productoId: item.productoId,
          descripcion: previo?.descripcion ?? p!.descripcion,
          cantidad: item.cantidad,
          valorUnitario: previo?.valorUnitario ?? p!.valor,
        };
      });
    }

    // Si cambia el total de una remisión ya pagada, vuelve a pendiente para que se confirme el cobro de nuevo
    if (nuevasLineas && actual.pagada) {
      const totalNuevo = nuevasLineas.reduce((a, l) => a + l.cantidad * l.valorUnitario, 0);
      const totalActual = actual.items.reduce((a, l) => a + l.cantidad * l.valorUnitario, 0);
      if (totalNuevo !== totalActual) {
        data.pagada = false;
        data.pagadaEn = null;
      }
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (nuevasLineas) {
          await tx.remisionItem.deleteMany({ where: { remisionId: id } });
          await tx.remisionItem.createMany({ data: nuevasLineas });
        }
        await tx.remision.update({ where: { id }, data });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        String(error.meta?.target).includes('numero')
      ) {
        throw this.numeroDuplicado(numero, tipo);
      }
      throw error;
    }
    return this.withTotal(await this.getOrFail(id));
  }

  async anular(id: number) {
    const resultado = await this.prisma.remision.updateMany({
      where: { id, anulada: false },
      data: { anulada: true, anuladaEn: new Date() },
    });
    if (resultado.count === 0) {
      const remision = await this.getOrFail(id);
      if (remision.anulada) throw new BadRequestException('La remisión ya está anulada');
    }
    return this.withTotal(await this.getOrFail(id));
  }

  /** Deshace una anulación hecha por error: la remisión vuelve a estar vigente con su mismo número */
  async reactivar(id: number) {
    const resultado = await this.prisma.remision.updateMany({
      where: { id, anulada: true },
      data: { anulada: false, anuladaEn: null, editadaEn: new Date() },
    });
    if (resultado.count === 0) {
      await this.getOrFail(id);
      throw new BadRequestException('La remisión no está anulada');
    }
    return this.withTotal(await this.getOrFail(id));
  }

  /** Marca una remisión como pagada (o pendiente) */
  async marcarPago(id: number, pagada: boolean) {
    const remision = await this.getOrFail(id);
    if (remision.anulada) throw new BadRequestException('Una remisión anulada no se cobra');
    await this.prisma.remision.update({ where: { id }, data: { pagada, pagadaEn: pagada ? new Date() : null } });
    return this.withTotal(await this.getOrFail(id));
  }

  /** Excel con el formato del laboratorio */
  async excel(id: number) {
    const r = await this.getOrFail(id);
    const buffer = await generarRemisionExcel({
      numero: r.tipo === TipoRemision.ELECTRONICA ? `FE-${r.numero}` : r.numero,
      fecha: r.fecha,
      doctor: r.doctorNombre ?? r.caso.cliente.nombre,
      paciente: r.pacienteNombre ?? r.caso.pacienteNombre ?? '',
      noOrden: r.noOrden ?? r.caso.codigo,
      anulada: r.anulada,
      items: r.items.map((i) => ({
        cantidad: i.cantidad,
        descripcion: i.descripcion,
        valorUnitario: i.valorUnitario,
      })),
    });
    const etiqueta = r.tipo === TipoRemision.ELECTRONICA ? `FE-${r.numero}` : `No_${r.numero}`;
    return { buffer, filename: `REMISION_${etiqueta}.xlsx` };
  }

  // ---------------------------------------------------------------- HELPERS

  private async getOrFail(id: number) {
    const r = await this.prisma.remision.findUnique({ where: { id }, include: REMISION_INCLUDE });
    if (!r) throw new NotFoundException(`La remisión #${id} no existe`);
    return r;
  }

  private withTotal(r: RemisionConItems) {
    return { ...r, total: r.items.reduce((acc, i) => acc + i.cantidad * i.valorUnitario, 0) };
  }

  private async nextNumero(tipo: TipoRemision): Promise<number | null> {
    const ultima = await this.prisma.remision.aggregate({ where: { tipo }, _max: { numero: true } });
    if (ultima._max.numero === null) return null;
    return ultima._max.numero < MAX_NUMERO_REMISION ? ultima._max.numero + 1 : null;
  }

  private numeroDuplicado(numero: number, tipo: TipoRemision) {
    const etiqueta = tipo === TipoRemision.ELECTRONICA ? `FE-${numero}` : String(numero);
    return new BadRequestException(`El número de remisión ${etiqueta} ya existe`);
  }
}
