import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
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

  /** GET /cuentas-cobro?anio=2026&mes=10 */
  @Get()
  listar(@Query('anio') anio: string, @Query('mes') mes: string) {
    const hoy = new Date();
    return this.cuentas.listar(
      anio ? Number(anio) : hoy.getFullYear(),
      mes ? Number(mes) : hoy.getMonth() + 1,
    );
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
