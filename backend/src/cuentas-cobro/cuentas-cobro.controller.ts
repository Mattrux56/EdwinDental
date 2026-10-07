import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { CuentasCobroService } from './cuentas-cobro.service';

class PagoDto {
  @IsBoolean() pagada!: boolean;
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

  /** PATCH /cuentas-cobro/:clienteId/:anio/:mes/pago — marca todas las remisiones del mes de ese cliente */
  @Patch(':clienteId/:anio/:mes/pago')
  pago(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Param('anio', ParseIntPipe) anio: number,
    @Param('mes', ParseIntPipe) mes: number,
    @Body() dto: PagoDto,
  ) {
    return this.cuentas.marcarCuenta(clienteId, anio, mes, dto.pagada);
  }
}
