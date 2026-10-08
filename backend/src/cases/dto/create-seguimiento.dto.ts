import { Transform } from 'class-transformer';
import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ESTADOS_CASO, TIPOS_SEGUIMIENTO } from '../cases.constants';

export class CreateSeguimientoDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsIn(TIPOS_SEGUIMIENTO, { message: 'El tipo de movimiento no es válido' })
  tipo!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  descripcion!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsIn(ESTADOS_CASO, { message: 'El estado del caso no es válido' })
  estado!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de entrega debe tener el formato AAAA-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'La fecha de entrega no es válida' })
  fechaEntregaEstimada?: string;
}
