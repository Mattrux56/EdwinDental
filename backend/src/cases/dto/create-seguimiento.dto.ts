import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ESTADOS_CASO, TIPOS_SEGUIMIENTO } from '../cases.constants';

export class CreateSeguimientoDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsIn(TIPOS_SEGUIMIENTO, { message: 'El tipo de movimiento no es válido' })
  tipo?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  descripcion!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsIn(ESTADOS_CASO, { message: 'El estado del caso no es válido' })
  estado?: string;
}
