import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { CreateSeguimientoDto } from './dto/create-seguimiento.dto';

/** Relaciones que siempre se devuelven: cliente + línea de tiempo con fotos, ordenada por fecha */
const CASO_INCLUDE = {
  cliente: true,
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

  /** Búsqueda flexible e insensible a mayúsculas: código, título, cliente, documento o ID */
  async findAll(search?: string) {
    const term = search?.trim();
    const where: Prisma.CasoWhereInput = {};

    if (term) {
      const or: Prisma.CasoWhereInput[] = [
        { codigo: { contains: term, mode: 'insensitive' } },
        { titulo: { contains: term, mode: 'insensitive' } },
        { cliente: { nombre: { contains: term, mode: 'insensitive' } } },
        {
          cliente: {
            documentoIdentidad: { contains: term, mode: 'insensitive' },
          },
        },
      ];
      if (/^\d{1,9}$/.test(term)) {
        or.push({ id: Number(term) });
      }
      where.OR = or;
    }

    return this.prisma.caso.findMany({
      where,
      include: CASO_INCLUDE,
      orderBy: { creadoEn: 'desc' },
    });
  }

  async findOne(id: number) {
    const caso = await this.prisma.caso.findUnique({
      where: { id },
      include: CASO_INCLUDE,
    });
    if (!caso) throw new NotFoundException(`El caso #${id} no existe`);
    return caso;
  }

  /** Métricas para las tarjetas del dashboard */
  async stats() {
    const grouped = await this.prisma.caso.groupBy({
      by: ['estado'],
      _count: { _all: true },
    });
    const count = (estado: string) =>
      grouped.find((g) => g.estado === estado)?._count._all ?? 0;

    return {
      total: grouped.reduce((acc, g) => acc + g._count._all, 0),
      enLaboratorio: count('En Laboratorio'),
      enProceso: count('En Proceso'),
      finalizados: count('Finalizado'),
    };
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
            titulo: dto.titulo.trim(),
            cliente: this.buildClienteRelation(dto),
            seguimientos: {
              create: {
                tipo: dto.tipo?.trim() || 'Ingreso Inicial',
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
          String(e.meta?.target).includes('codigo');
        if (codigoDuplicado) continue; // recalcular y reintentar
        throw e;
      }
    }
    throw new BadRequestException(
      'No fue posible generar un código único para el caso. Intenta de nuevo.',
    );
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
            tipo: dto.tipo?.trim() || 'Reingreso',
            descripcion: dto.descripcion.trim(),
            imagenes: { create: urls.map((urlImagen) => ({ urlImagen })) },
          },
        },
      },
    });

    return this.findOne(casoId);
  }

  // ---------------------------------------------------------------- HELPERS

  private buildClienteRelation(
    dto: CreateCaseDto,
  ): Prisma.ClienteCreateNestedOneWithoutCasosInput {
    const nombre = dto.clienteNombre.trim();
    const documento = dto.documentoIdentidad?.trim();

    if (documento) {
      // Si el documento ya existe se reutiliza el cliente; si no, se crea
      return {
        connectOrCreate: {
          where: { documentoIdentidad: documento },
          create: { nombre, documentoIdentidad: documento },
        },
      };
    }
    return { create: { nombre } };
  }

  /** Genera el siguiente código del año: CASO-2026-001, CASO-2026-002, ... */
  private async nextCodigo(): Promise<string> {
    const prefix = `CASO-${new Date().getFullYear()}-`;
    const existentes = await this.prisma.caso.findMany({
      where: { codigo: { startsWith: prefix } },
      select: { codigo: true },
    });

    // Se calcula el máximo numéricamente (así no se rompe al pasar de 999)
    const max = existentes.reduce((acc, { codigo }) => {
      const n = parseInt(codigo.slice(prefix.length), 10);
      return Number.isNaN(n) ? acc : Math.max(acc, n);
    }, 0);

    return `${prefix}${String(max + 1).padStart(3, '0')}`;
  }

  private async ensureExists(id: number) {
    const found = await this.prisma.caso.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException(`El caso #${id} no existe`);
  }

  private uploadFiles(files: Express.Multer.File[], folder: string) {
    return Promise.all(files.map((f) => this.supabase.uploadImage(f, folder)));
  }
}
