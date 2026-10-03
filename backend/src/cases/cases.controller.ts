import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CasesService } from './cases.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { CreateSeguimientoDto } from './dto/create-seguimiento.dto';

/** Campo multipart: "fotos" (hasta 6 imágenes de máx. 8 MB) */
const fotosInterceptor = () =>
  FilesInterceptor('fotos', 6, {
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith('image/')) return cb(null, true);
      cb(new BadRequestException('Solo se permiten archivos de imagen'), false);
    },
  });

@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  /** GET /cases?search=texto */
  @Get()
  findAll(@Query('search') search?: string) {
    return this.casesService.findAll(search);
  }

  /** GET /cases/stats  (declarado antes de :id para no chocar con la ruta) */
  @Get('stats')
  stats() {
    return this.casesService.stats();
  }

  /** GET /cases/:id */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.casesService.findOne(id);
  }

  /** POST /cases  (multipart/form-data) */
  @Post()
  @UseInterceptors(fotosInterceptor())
  create(
    @Body() dto: CreateCaseDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.casesService.create(dto, files ?? []);
  }

  /** POST /cases/:id/seguimiento  (multipart/form-data) */
  @Post(':id/seguimiento')
  @UseInterceptors(fotosInterceptor())
  addSeguimiento(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSeguimientoDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.casesService.addSeguimiento(id, dto, files ?? []);
  }
}
