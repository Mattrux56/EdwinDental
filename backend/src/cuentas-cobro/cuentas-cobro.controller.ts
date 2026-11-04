import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, StreamableFile } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsInt } from 'class-validator';
import { CuentasCobroService } from './cuentas-cobro.service';

class PagosDto {
  /** Ids de las remisiones que quedan pagadas; el resto de la cuenta queda pendiente */
  @IsArray()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  pagadas!: number[];
}

@Controller('cuentas-cobro')
export class CuentasCobroController {
  constructor(private readonly cuentas: CuentasCobroService) {}

  /** GET /cuentas-cobro?anio=2026&mes=10 · GET /cuentas-cobro?todas=1 (todos los meses) */
  @Get()
  listar(@Query('anio') anio: string, @Query('mes') mes: string, @Query('todas') todas?: string) {
    if (todas === '1') return this.cuentas.listar();
    const hoy = new Date();
    return this.cuentas.listar(
      anio ? Number(anio) : hoy.getFullYear(),
      mes ? Number(mes) : hoy.getMonth() + 1,
    );
  }

  /** GET /cuentas-cobro/excel: todas las remisiones vigentes y su estado de pago en un .xlsx (una hoja por cliente) */
  @Get('excel')
  async excel() {
    const { buffer, filename } = await this.cuentas.excel();
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  /** PATCH /cuentas-cobro/:clienteId/pagos — igual, pero con las remisiones de todos los meses */
  @Patch(':clienteId/pagos')
  pagosTodas(@Param('clienteId', ParseIntPipe) clienteId: number, @Body() dto: PagosDto) {
    return this.cuentas.guardarPagos(clienteId, undefined, undefined, dto.pagadas);
  }

  /** PATCH /cuentas-cobro/:clienteId/:anio/:mes/pagos — guarda cuáles remisiones del mes están pagadas */
  @Patch(':clienteId/:anio/:mes/pagos')
  pagos(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Param('anio', ParseIntPipe) anio: number,
    @Param('mes', ParseIntPipe) mes: number,
    @Body() dto: PagosDto,
  ) {
    return this.cuentas.guardarPagos(clienteId, anio, mes, dto.pagadas);
  }
}
