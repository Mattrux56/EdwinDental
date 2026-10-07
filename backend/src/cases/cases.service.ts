import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { dateOnlyToUtc, todayLocal } from '../common/date-only';
import { PrismaService } from '../prisma/prisma.service';
import { claveNombre } from '../clientes/nombre';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { CreateSeguimientoDto } from './dto/create-seguimiento.dto';
import { UpdateCaseDto } from './dto/update-case.dto';

/** Días de anticipación con los que un caso aparece en Alertas */
const ALERTA_DIAS = 3;

const CODIGO_CARACTERES = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** YYYY-MM-DD + n días (sin depender de la zona horaria) */
function addDays(fecha: string, dias: number): string {
  const d = dateOnlyToUtc(fecha);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Relaciones que siempre se devuelven: cliente + línea de tiempo con fotos, ordenada por fecha */
const CASO_INCLUDE = {
  cliente: { select: { id: true, nombre: true } },
  seguimientos: {
    orderBy: { creadoEn: 'asc' },
    include: { imagenes: { orderBy: { subidoEn: 'asc' } } },
  },
} satisfies Prisma.CasoInclude;

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  // ---------------------------------------------------------------- LECTURA

  /** Búsqueda flexible e insensible a mayúsculas: código, título, paciente, cliente o ID */
  async findAll(search?: string, archivados = false) {
    const term = search?.trim();
    const where: Prisma.CasoWhereInput = { archivado: archivados };

    if (term) {
      const or: Prisma.CasoWhereInput[] = [
        { codigo: { contains: term, mode: 'insensitive' } },
        { titulo: { contains: term, mode: 'insensitive' } },
        { pacienteNombre: { contains: term, mode: 'insensitive' } },
        { cliente: { nombre: { contains: term, mode: 'insensitive' } } },
      ];
      if (/^\d{1,9}$/.test(term)) {
        or.push({ id: Number(term) });
      }
      where.OR = or;
    }

    const casos = await this.prisma.caso.findMany({
      where,
      include: CASO_INCLUDE,
      orderBy: { creadoEn: 'desc' },
    });
    return casos.map((caso) => this.normalizeLegacyStatus(caso));
  }

  async findOne(id: number) {
    const caso = await this.prisma.caso.findUnique({
      where: { id },
      include: CASO_INCLUDE,
    });
    if (!caso) throw new NotFoundException(`El caso #${id} no existe`);
    return this.normalizeLegacyStatus(caso);
  }

  async findClients() {
    return this.prisma.cliente.findMany({
      select: {
        id: true,
        nombre: true,
        _count: { select: { casos: true } },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async findPublic(codigo: string) {
    const caso = await this.prisma.caso.findUnique({
      where: { codigoPublico: codigo },
      select: {
        codigo: true,
        titulo: true,
        estado: true,
        creadoEn: true,
        fechaIngreso: true,
        fechaEntregaEstimada: true,
        seguimientos: {
          orderBy: { creadoEn: 'asc' },
          select: {
            id: true,
            tipo: true,
            descripcion: true,
            creadoEn: true,
            imagenes: {
              orderBy: { subidoEn: 'asc' },
              select: { id: true, urlImagen: true, subidoEn: true },
            },
          },
        },
      },
    });
    if (!caso) throw new NotFoundException(`El caso ${codigo} no existe`);
    return this.normalizeLegacyStatus(caso);
  }

  async ticket(id: number) {
    const caso = await this.prisma.caso.findUnique({
      where: { id },
      select: {
        id: true,
        codigo: true,
        codigoPublico: true,
        titulo: true,
        estado: true,
        creadoEn: true,
        fechaEntregaEstimada: true,
        precio: true,
        cliente: { select: { nombre: true } },
      },
    });
    if (!caso) throw new NotFoundException(`El caso #${id} no existe`);
    return caso;
  }

  /** Métricas para las tarjetas del dashboard (los casos archivados no cuentan) */
  async stats() {
    const [grouped, archivados, alertas] = await Promise.all([
      this.prisma.caso.groupBy({
        by: ['estado'],
        where: { archivado: false },
        _count: { _all: true },
      }),
      this.prisma.caso.count({ where: { archivado: true } }),
      this.prisma.caso.count({
        where: {
          archivado: false,
          fechaEntregaEstimada: { not: null, lte: dateOnlyToUtc(addDays(todayLocal(), ALERTA_DIAS)) },
          NOT: { estado: { equals: 'Finalizado', mode: 'insensitive' } },
        },
      }),
    ]);
    const count = (estado: string) =>
      grouped
        .filter((g) => g.estado.toLocaleLowerCase('es') === estado.toLocaleLowerCase('es'))
        .reduce((total, g) => total + g._count._all, 0);

    return {
      total: grouped.reduce((acc, g) => acc + g._count._all, 0),
      enLaboratorio: count('En laboratorio'), // la comparación ya ignora mayúsculas: sumar dos variantes contaba el doble
      enPrueba: count('En prueba') + count('En Proceso'),
      finalizados: count('Finalizado'),
      arreglos: count('arreglo'),
      archivados,
      alertas,
    };
  }

  /** Casos sin finalizar cuya entrega está vencida, es hoy o vence en los próximos días */
  async alertas() {
    const hoy = todayLocal();
    const casos = await this.prisma.caso.findMany({
      where: {
        archivado: false,
        fechaEntregaEstimada: { not: null, lte: dateOnlyToUtc(addDays(hoy, ALERTA_DIAS)) },
        NOT: { estado: { equals: 'Finalizado', mode: 'insensitive' } },
      },
      select: {
        id: true,
        codigo: true,
        titulo: true,
        estado: true,
        pacienteNombre: true,
        fechaEntregaEstimada: true,
        cliente: { select: { id: true, nombre: true } },
      },
      orderBy: { fechaEntregaEstimada: 'asc' },
    });
    const base = dateOnlyToUtc(hoy).getTime();
    return casos.map((c) => {
      const dias = Math.round((c.fechaEntregaEstimada!.getTime() - base) / 86_400_000);
      return {
        ...this.normalizeLegacyStatus(c),
        dias,
        nivel: dias < 0 ? 'vencido' : dias === 0 ? 'hoy' : 'proximo',
      };
    });
  }

  // -------------------------------------------------------------- ESCRITURA

  async create(dto: CreateCaseDto, files: Express.Multer.File[] = []) {
    // 1) Fotos primero: si falla la subida no se crea nada en la base de datos
    const urls = await this.uploadFiles(files, `casos/${new Date().getFullYear()}`);

    // 2) Creación atómica (cliente + caso + primer seguimiento + imágenes)
    //    con reintento si dos usuarios generan el mismo código a la vez.
    for (let attempt = 0; attempt < 5; attempt++) {
      const codigo = await this.nextCodigo();
      try {
        return await this.prisma.caso.create({
          data: {
            codigo,
            codigoPublico: randomBytes(6).toString('hex'),
            titulo: dto.titulo.trim(),
            pacienteNombre: dto.pacienteNombre.trim(),
            estado: 'En laboratorio',
            fechaIngreso: dateOnlyToUtc(dto.fechaIngreso ?? todayLocal()),
            ...(dto.fechaEntregaEstimada
              ? { fechaEntregaEstimada: dateOnlyToUtc(dto.fechaEntregaEstimada) }
              : {}),
            cliente: await this.buildClienteRelation(dto),
            seguimientos: {
              create: {
                tipo: 'prueba',
                    descripcion: dto.descripcion.trim(),
                imagenes: { create: urls.map((urlImagen) => ({ urlImagen })) },
              },
            },
          },
          include: CASO_INCLUDE,
        });
      } catch (e) {
        const codigoDuplicado =
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002' &&
          /codigo/i.test(String(e.meta?.target)); // también cubre codigoPublico
        if (codigoDuplicado) continue; // recalcular y reintentar
        throw e;
      }
    }
    throw new BadRequestException(
      'No fue posible generar un código único para el caso. Intenta de nuevo.',
    );
  }

  async remove(id: number) {
    await this.ensureExists(id);
    const remisiones = await this.prisma.remision.count({ where: { casoId: id } });
    if (remisiones > 0) {
      throw new BadRequestException(
        `No se puede eliminar el caso: tiene ${remisiones} ${remisiones === 1 ? 'remisión registrada' : 'remisiones registradas'}. Las remisiones (incluso las anuladas) quedan como respaldo y por eso el caso no se puede eliminar.`,
      );
    }
    const imagenes = await this.prisma.casoImagen.findMany({
      where: { seguimiento: { casoId: id } },
      select: { urlImagen: true },
    });
    await this.prisma.caso.delete({ where: { id } });
    // Los archivos de Storage se borran después; si falla, el caso ya quedó eliminado y solo sobran archivos
    await this.supabase.removeByUrls(imagenes.map((i) => i.urlImagen));
    return { id, eliminado: true };
  }

  /** Archivar saca el caso de los listados sin perder nada; se puede restaurar */
  async setArchivado(id: number, archivado: boolean) {
    await this.ensureExists(id);
    await this.prisma.caso.update({
      where: { id },
      data: { archivado, archivadoEn: archivado ? new Date() : null },
    });
    return this.findOne(id);
  }

  async update(id: number, dto: UpdateCaseDto) {
    await this.ensureExists(id);
    const data: Prisma.CasoUpdateInput = {};
    if (dto.titulo !== undefined) data.titulo = dto.titulo.trim();
    if (dto.pacienteNombre !== undefined) data.pacienteNombre = dto.pacienteNombre.trim();
    if (dto.fechaIngreso !== undefined) data.fechaIngreso = dateOnlyToUtc(dto.fechaIngreso);
    if (dto.fechaEntregaEstimada !== undefined) {
      data.fechaEntregaEstimada = dto.fechaEntregaEstimada ? dateOnlyToUtc(dto.fechaEntregaEstimada) : null;
    }
    if (dto.clienteId !== undefined) {
      const cliente = await this.prisma.cliente.findUnique({ where: { id: dto.clienteId }, select: { id: true } });
      if (!cliente) throw new NotFoundException(`El cliente #${dto.clienteId} no existe`);
      data.cliente = { connect: { id: cliente.id } };
    } else if (dto.clienteNombre !== undefined) {
      const nombre = dto.clienteNombre.trim();
      if (!nombre) throw new BadRequestException('El nombre del cliente es obligatorio');
      data.cliente = await this.clientePorNombre(nombre);
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('Indica al menos un dato para actualizar');
    await this.prisma.caso.update({ where: { id }, data });
    return this.findOne(id);
  }

  /** Elimina una foto del historial (registro y archivo) */
  async removeImagen(imagenId: number) {
    const imagen = await this.prisma.casoImagen.findUnique({
      where: { id: imagenId },
      select: { id: true, urlImagen: true, seguimiento: { select: { casoId: true } } },
    });
    if (!imagen) throw new NotFoundException(`La foto #${imagenId} no existe`);
    await this.prisma.casoImagen.delete({ where: { id: imagenId } });
    await this.supabase.removeByUrls([imagen.urlImagen]);
    return this.findOne(imagen.seguimiento.casoId);
  }

  async addSeguimiento(
    casoId: number,
    dto: CreateSeguimientoDto,
    files: Express.Multer.File[] = [],
  ) {
    await this.ensureExists(casoId);
    const urls = await this.uploadFiles(files, `casos/${casoId}`);

    const nuevoEstado = dto.estado?.trim();

    await this.prisma.caso.update({
      where: { id: casoId },
      data: {
        ...(nuevoEstado ? { estado: nuevoEstado } : {}),
        seguimientos: {
          create: {
            tipo: dto.tipo?.trim() || 'reingreso',
            descripcion: dto.descripcion.trim(),
            imagenes: { create: urls.map((urlImagen) => ({ urlImagen })) },
          },
        },
      },
    });

    return this.findOne(casoId);
  }

  // ---------------------------------------------------------------- HELPERS

  private async buildClienteRelation(
    dto: CreateCaseDto,
  ): Promise<Prisma.ClienteCreateNestedOneWithoutCasosInput> {
    if (dto.clienteId !== undefined) {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id: dto.clienteId },
        select: { id: true },
      });
      if (!cliente) {
        throw new NotFoundException(`El cliente #${dto.clienteId} no existe`);
      }
      return { connect: { id: cliente.id } };
    }
    const nombre = dto.clienteNombre?.trim();
    if (!nombre) throw new BadRequestException('El nombre del cliente es obligatorio');
    return this.clientePorNombre(nombre);
  }

  /** Si ya existe un cliente con ese nombre (sin importar mayúsculas ni tildes) se usa, en vez de crear un duplicado */
  private async clientePorNombre(nombre: string): Promise<Prisma.ClienteCreateNestedOneWithoutCasosInput> {
    const clave = claveNombre(nombre);
    const existentes = await this.prisma.cliente.findMany({ select: { id: true, nombre: true } });
    const igual = existentes.find((c) => claveNombre(c.nombre) === clave);
    return igual ? { connect: { id: igual.id } } : { create: { nombre } };
  }

  /** Código del caso: CASO-2026-A7K3Q (año + 5 letras y números sin caracteres confusos como O/0 o I/1) */
  private async nextCodigo(): Promise<string> {
    const prefix = `CASO-${new Date().getFullYear()}-`;
    const bytes = randomBytes(5);
    let sufijo = '';
    for (const b of bytes) sufijo += CODIGO_CARACTERES[b % CODIGO_CARACTERES.length];
    return `${prefix}${sufijo}`; // si ya existe, create() reintenta con otro
  }

  private async ensureExists(id: number) {
    const found = await this.prisma.caso.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException(`El caso #${id} no existe`);
  }

  private normalizeLegacyStatus<T extends { estado: string }>(caso: T): T {
    const normalized = caso.estado.toLocaleLowerCase('es');
    const estado = normalized === 'en proceso'
      ? 'En prueba'
      : normalized === 'en laboratorio'
        ? 'En laboratorio'
        : normalized === 'finalizado'
          ? 'Finalizado'
          : normalized === 'arreglo'
            ? 'arreglo'
            : caso.estado;
    return estado === caso.estado ? caso : { ...caso, estado };
  }

  private uploadFiles(files: Express.Multer.File[], folder: string) {
    return Promise.all(files.map((f) => this.supabase.uploadImage(f, folder)));
  }
}
