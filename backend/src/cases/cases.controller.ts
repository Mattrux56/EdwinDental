import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { CreateSeguimientoDto } from './dto/create-seguimiento.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { UpdateSeguimientoDto } from './dto/update-seguimiento.dto';

const MAX_FOTOS = 6;
const MAX_FOTO_BYTES = 8 * 1024 * 1024; // 8 MB, el mismo límite que anuncia la pantalla

/** Límites de subida: sin esto cualquier archivo, de cualquier tamaño, se cargaba completo en memoria */
const FOTOS_OPTIONS = {
  limits: { files: MAX_FOTOS, fileSize: MAX_FOTO_BYTES },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new BadRequestException('Solo se permiten archivos de imagen'), false);
  },
};

/** Número entero positivo de un parámetro de la URL; si no lo es, se ignora */
const entero = (valor?: string) => {
  const n = Number(valor);
  return valor && Number.isInteger(n) && n > 0 ? n : undefined;
};

@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('archivados') archivados?: string,
    @Query('clienteId') clienteId?: string,
    @Query('estado') estado?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.casesService.findAll(search, archivados === '1' || archivados === 'true', {
      clienteId: entero(clienteId),
      estado: estado?.trim() || undefined,
      limit: entero(limit),
      offset: entero(offset),
    });
  }

  @Get('stats')
  stats() {
    return this.casesService.stats();
  }

  @Get('alertas')
  alertas() {
    return this.casesService.alertas();
  }

  @Get('clientes')
  clients() {
    return this.casesService.findClients();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.casesService.findOne(id);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('fotos', MAX_FOTOS, FOTOS_OPTIONS))
  create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: CreateCaseDto,
  ) {
    return this.casesService.create(dto, files);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCaseDto) {
    return this.casesService.update(id, dto);
  }

  @Patch(':id/archivar')
  archivar(@Param('id', ParseIntPipe) id: number) {
    return this.casesService.setArchivado(id, true);
  }

  @Patch(':id/restaurar')
  restaurar(@Param('id', ParseIntPipe) id: number) {
    return this.casesService.setArchivado(id, false);
  }

  @Delete('imagenes/:imagenId')
  removeImagen(@Param('imagenId', ParseIntPipe) imagenId: number) {
    return this.casesService.removeImagen(imagenId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.casesService.remove(id);
  }

  @Post(':id/seguimiento')
  @UseInterceptors(FilesInterceptor('fotos', MAX_FOTOS, FOTOS_OPTIONS))
  addSeguimiento(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: CreateSeguimientoDto,
  ) {
    return this.casesService.addSeguimiento(id, dto, files);
  }

  @Patch(':id/seguimiento/:seguimientoId')
  @UseInterceptors(FilesInterceptor('fotos', MAX_FOTOS, FOTOS_OPTIONS))
  updateSeguimiento(
    @Param('id', ParseIntPipe) id: number,
    @Param('seguimientoId', ParseIntPipe) seguimientoId: number,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UpdateSeguimientoDto,
  ) {
    return this.casesService.updateSeguimiento(id, seguimientoId, dto, files);
  }

  @Delete(':id/seguimiento/:seguimientoId')
  removeSeguimiento(
    @Param('id', ParseIntPipe) id: number,
    @Param('seguimientoId', ParseIntPipe) seguimientoId: number,
  ) {
    return this.casesService.removeSeguimiento(id, seguimientoId);
  }
}
