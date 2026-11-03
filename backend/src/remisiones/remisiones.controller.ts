import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  ParseIntPipe,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { CreateRemisionDto, TipoRemision } from './dto/create-remision.dto';
import { UpdateRemisionDto } from './dto/update-remision.dto';
import { RemisionesService } from './remisiones.service';

/** Número entero positivo de un parámetro de la URL; si no lo es, se ignora */
const entero = (valor?: string) => {
  const n = Number(valor);
  return valor && Number.isInteger(n) && n > 0 ? n : undefined;
};

const XLSX ='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('remisiones')
export class RemisionesController {
  constructor(private readonly remisiones: RemisionesService) {}

  /** GET /remisiones  (opcionales: casoId, clienteId, desde, hasta [YYYY-MM-DD], limit, offset) */
  @Get()
  findAll(
    @Query('casoId') casoId?: string,
    @Query('clienteId') clienteId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const fecha = (valor?: string) => (valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : undefined);
    return this.remisiones.findAll({
      casoId: entero(casoId),
      clienteId: entero(clienteId),
      desde: fecha(desde),
      hasta: fecha(hasta),
      limit: entero(limit),
      offset: entero(offset),
    });
  }

  /** GET /remisiones/siguiente-numero */
  @Get('siguiente-numero')
  siguienteNumero(@Query('tipo') tipo?: string) {
    const tipoValido = Object.values(TipoRemision).find((opcion) => opcion === tipo);
    if (tipo && !tipoValido) {
      throw new BadRequestException('El tipo de remisión no es válido');
    }
    return this.remisiones.siguienteNumero(tipoValido ?? TipoRemision.NORMAL);
  }

  /** PATCH /remisiones/:id/anular */
  @Patch(':id/anular')
  anular(@Param('id', ParseIntPipe) id: number) {
    return this.remisiones.anular(id);
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

  /** DELETE /remisiones/:id  (solo si está anulada) */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.remisiones.remove(id);
  }

  /** PATCH /remisiones/:id  (corrige los datos y numeración de la remisión) */
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRemisionDto) {
    return this.remisiones.update(id, dto);
  }

}
