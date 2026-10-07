import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { exportarProductos, leerProductos } from './productos-excel';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('productos')
export class ProductosController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /productos: lista de precios activa, agrupable por categoría */
  @Get()
  findAll() {
    return this.prisma.producto.findMany({
      where: { activo: true },
      select: { id: true, codigo: true, categoria: true, descripcion: true, valor: true },
      orderBy: [{ codigo: 'asc' }, { id: 'asc' }],
    });
  }

  /** GET /productos/admin: catálogo completo para su administración */
  @Get('admin')
  findAllForAdmin() {
    return this.prisma.producto.findMany({
      select: { id: true, codigo: true, categoria: true, descripcion: true, valor: true, activo: true },
      orderBy: [{ categoria: 'asc' }, { codigo: 'asc' }, { id: 'asc' }],
    });
  }

  /** GET /productos/exportar: la lista de precios completa en Excel (el mismo formato que acepta la importación) */
  @Get('exportar')
  async exportar() {
    const productos = await this.prisma.producto.findMany({
      select: { codigo: true, categoria: true, descripcion: true, valor: true, activo: true },
      orderBy: [{ categoria: 'asc' }, { codigo: 'asc' }, { id: 'asc' }],
    });
    return new StreamableFile(await exportarProductos(productos), {
      type: XLSX,
      disposition: 'attachment; filename="lista_de_precios.xlsx"',
    });
  }

  /**
   * POST /productos/importar (multipart, campo "archivo"): crea los productos nuevos y actualiza categoría/valor de los
   * existentes (se identifican por código + descripción). Nunca borra productos y los precios ya emitidos en remisiones no cambian.
   */
  @Post('importar')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async importar(@UploadedFile() archivo?: Express.Multer.File) {
    if (!archivo?.buffer) throw new BadRequestException('Selecciona un archivo Excel (.xlsx)');
    let lectura: Awaited<ReturnType<typeof leerProductos>>;
    try {
      lectura = await leerProductos(archivo.buffer);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    if (lectura.filas.length === 0) throw new BadRequestException('El archivo no tiene productos para importar');

    const existentes = await this.prisma.producto.findMany({ select: { id: true, codigo: true, descripcion: true } });
    const clave = (codigo: number, descripcion: string) => `${codigo}|${descripcion.toLowerCase()}`;
    const porClave = new Map(existentes.map((p) => [clave(p.codigo, p.descripcion), p.id]));

    // Si el archivo repite un producto, gana la última fila
    const unicos = new Map(lectura.filas.map((f) => [clave(f.codigo, f.descripcion), f]));
    let creados = 0;
    let actualizados = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const [k, f] of unicos) {
        const id = porClave.get(k);
        if (id) {
          await tx.producto.update({
            where: { id },
            data: { categoria: f.categoria, valor: f.valor, ...(f.activo !== undefined ? { activo: f.activo } : {}) },
          });
          actualizados++;
        } else {
          await tx.producto.create({
            data: { codigo: f.codigo, categoria: f.categoria, descripcion: f.descripcion, valor: f.valor, activo: f.activo ?? true },
          });
          creados++;
        }
      }
    }, { timeout: 60_000 });
    return { creados, actualizados, omitidas: lectura.omitidas };
  }

  /** POST /productos: agrega un producto a la lista de precios */
  @Post()
  async create(@Body() dto: CreateProductoDto) {
    const data = {
      codigo: dto.codigo,
      categoria: this.requiredText(dto.categoria, 'La categoría es obligatoria'),
      descripcion: this.requiredText(dto.descripcion, 'La descripción es obligatoria'),
      valor: dto.valor,
    };
    try {
      return await this.prisma.producto.create({
        data,
        select: { id: true, codigo: true, categoria: true, descripcion: true, valor: true, activo: true },
      });
    } catch (error) {
      this.throwIfDuplicate(error);
      throw error;
    }
  }

  /** PATCH /productos/:id: edita el producto o cambia su estado activo */
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductoDto,
  ) {
    const data = this.normalize(dto);
    if (Object.keys(data).length === 0 && dto.activo === undefined) {
      throw new BadRequestException('Indica al menos un campo para actualizar');
    }
    try {
      return await this.prisma.producto.update({
        where: { id },
        data: { ...data, ...(dto.activo !== undefined ? { activo: dto.activo } : {}) },
        select: { id: true, codigo: true, categoria: true, descripcion: true, valor: true, activo: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`El producto #${id} no existe`);
      }
      this.throwIfDuplicate(error);
      throw error;
    }
  }

  private normalize(
    dto: CreateProductoDto | UpdateProductoDto,
  ): { codigo?: number; categoria?: string; descripcion?: string; valor?: number } {
    return {
      ...(dto.codigo !== undefined ? { codigo: dto.codigo } : {}),
      ...(dto.categoria !== undefined
        ? { categoria: this.requiredText(dto.categoria, 'La categoría es obligatoria') }
        : {}),
      ...(dto.descripcion !== undefined
        ? { descripcion: this.requiredText(dto.descripcion, 'La descripción es obligatoria') }
        : {}),
      ...(dto.valor !== undefined ? { valor: dto.valor } : {}),
    };
  }

  private requiredText(value: string, message: string): string {
    const trimmed = value.trim();
    if (!trimmed) throw new BadRequestException(message);
    return trimmed;
  }

  private throwIfDuplicate(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new BadRequestException('Ya existe un producto con ese código y descripción');
    }
  }
}
