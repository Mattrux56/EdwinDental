import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseIntPipe,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { CreateRemisionDto } from './dto/create-remision.dto';
import { UpdateRemisionDto } from './dto/update-remision.dto';
import { RemisionesService } from './remisiones.service';

class PagoRemisionDto {
  @IsBoolean() pagada!: boolean;
}

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('remisiones')
export class RemisionesController {
  constructor(private readonly remisiones: RemisionesService) {}

  /** GET /remisiones  (?casoId= para ver solo las de un caso) */
  @Get()
  findAll(@Query('casoId') casoId?: string) {
    const id = Number(casoId);
    return this.remisiones.findAll(Number.isInteger(id) && id > 0 ? id : undefined);
  }

  /** GET /remisiones/siguiente-numero */
  @Get('siguiente-numero')
  siguienteNumero() {
    return this.remisiones.siguienteNumero();
  }

  /** PATCH /remisiones/:id/anular */
  @Patch(':id/anular')
  anular(@Param('id', ParseIntPipe) id: number) {
    return this.remisiones.anular(id);
  }

  /** PATCH /remisiones/:id/pago  { pagada: boolean } */
  @Patch(':id/pago')
  pago(@Param('id', ParseIntPipe) id: number, @Body() dto: PagoRemisionDto) {
    return this.remisiones.marcarPago(id, dto.pagada);
  }

  /** PATCH /remisiones/:id/reactivar (quita la anulación) */
  @Patch(':id/reactivar')
  reactivar(@Param('id', ParseIntPipe) id: number) {
    return this.remisiones.reactivar(id);
  }

  /** GET /remisiones/:id/excel (declarado antes de :id para no chocar con la ruta) */
  @Get(':id/excel')
  async excel(@Param('id', ParseIntPipe) id: number) {
    const { buffer, filename } = await this.remisiones.excel(id);
    return new StreamableFile(buffer, { type: XLSX, disposition: `attachment; filename="${filename}"` });
  }

  /** GET /remisiones/:id */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.remisiones.findOne(id);
  }

  /** POST /remisiones  (JSON) */
  @Post()
  create(@Body() dto: CreateRemisionDto) {
    return this.remisiones.create(dto);
  }

  /** PATCH /remisiones/:id  (corrige la remisión sin cambiar su número) */
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRemisionDto) {
    return this.remisiones.update(id, dto);
  }

}
