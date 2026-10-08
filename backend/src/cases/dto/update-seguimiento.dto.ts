import { Transform } from 'class-transformer';
import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { TIPOS_SEGUIMIENTO } from '../cases.constants';

/** Edición de un seguimiento ya registrado. Todos los campos son opcionales; una fecha vacía la quita. */
export class UpdateSeguimientoDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsIn(TIPOS_SEGUIMIENTO, { message: 'El tipo de movimiento no es válido' })
  tipo?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'La descripción no puede quedar vacía' })
  @MaxLength(5000)
  descripcion?: string;

  @Transform(({ value }) => (typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value))
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de entrega debe tener el formato AAAA-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'La fecha de entrega no es válida' })
  fechaEntregaEstimada?: string | null;
}
