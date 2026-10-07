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

@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  findAll(@Query('search') search?: string, @Query('archivados') archivados?: string) {
    return this.casesService.findAll(search, archivados === '1' || archivados === 'true');
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

  @Get('publico/:codigo')
  findPublic(@Param('codigo') codigo: string) {
    return this.casesService.findPublic(codigo);
  }

  @Get(':id/ticket')
  ticket(@Param('id', ParseIntPipe) id: number) {
    return this.casesService.ticket(id);
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
}
