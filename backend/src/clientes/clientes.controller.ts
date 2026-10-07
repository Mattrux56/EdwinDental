import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { claveNombre } from './nombre';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

class CreateClienteDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(150)
  nombre!: string;
}

class UpdateClienteDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre no puede quedar vacío' })
  @MaxLength(150)
  nombre?: string;
}

const LISTA = {
  id: true,
  nombre: true,
  creadoEn: true,
  _count: { select: { casos: true } },
} satisfies Prisma.ClienteSelect;

/** Administración de clientes (doctores / clínicas) */
@Controller('clientes')
export class ClientesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll() {
    const clientes = await this.prisma.cliente.findMany({ select: LISTA, orderBy: { nombre: 'asc' } });
    // Remisiones vigentes (no anuladas) por cliente, igual que en las cuentas de cobro, en una sola consulta
    const remisiones = await this.prisma.remision.findMany({
      where: { anulada: false },
      select: { caso: { select: { clienteId: true } } },
    });
    const porCliente = new Map<number, number>();
    remisiones.forEach((r) => porCliente.set(r.caso.clienteId, (porCliente.get(r.caso.clienteId) ?? 0) + 1));
    return clientes.map((c) => ({ ...c, remisiones: porCliente.get(c.id) ?? 0 }));
  }

  @Post()
  async create(@Body() dto: CreateClienteDto) {
    await this.assertNombreLibre(dto.nombre);
    return this.prisma.cliente.create({ data: { nombre: dto.nombre }, select: LISTA });
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClienteDto) {
    if (dto.nombre === undefined) throw new BadRequestException('Indica el nombre del cliente');
    const actual = await this.prisma.cliente.findUnique({ where: { id }, select: { nombre: true } });
    if (!actual) throw new NotFoundException(`El cliente #${id} no existe`);
    // Solo se valida si el nombre realmente cambia (un cambio de mayúsculas en un cliente ya repetido sigue permitido)
    if (claveNombre(actual.nombre) !== claveNombre(dto.nombre)) await this.assertNombreLibre(dto.nombre, id);
    try {
      return await this.prisma.cliente.update({
        where: { id },
        data: { nombre: dto.nombre },
        select: LISTA,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException(`El cliente #${id} no existe`);
      }
      throw e;
    }
  }

  /** Solo se puede eliminar un cliente sin casos */
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id }, select: { id: true, _count: { select: { casos: true } } } });
    if (!cliente) throw new NotFoundException(`El cliente #${id} no existe`);
    if (cliente._count.casos > 0) {
      throw new BadRequestException(
        `No se puede eliminar: el cliente tiene ${cliente._count.casos} caso(s). Si está repetido, cambia el cliente de esos casos desde "Editar" en cada caso.`,
      );
    }
    await this.prisma.cliente.delete({ where: { id } });
    return { id, eliminado: true };
  }

  /** Evita crear o renombrar un cliente con el mismo nombre de otro (sin importar mayúsculas ni tildes) */
  private async assertNombreLibre(nombre: string, exceptoId?: number) {
    const clave = claveNombre(nombre);
    const todos = await this.prisma.cliente.findMany({ select: { id: true, nombre: true } });
    const igual = todos.find((c) => c.id !== exceptoId && claveNombre(c.nombre) === clave);
    if (igual) {
      throw new BadRequestException(`Ya existe un cliente llamado «${igual.nombre}». Usa ese cliente.`);
    }
  }
}
