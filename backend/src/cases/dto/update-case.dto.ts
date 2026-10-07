import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Edición parcial de un caso: solo se cambia lo que se envía */
export class UpdateCaseDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El título no puede quedar vacío' })
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre del paciente no puede quedar vacío' })
  @MaxLength(150)
  pacienteNombre?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clienteId?: number;

  /** Crea un cliente nuevo con ese nombre (si no se envía clienteId) */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  clienteNombre?: string;

  @IsOptional()
  @Transform(trim)
  @Matches(SOLO_FECHA, { message: 'La fecha de ingreso debe tener el formato AAAA-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'La fecha de ingreso no es válida' })
  fechaIngreso?: string;

  /** null o vacío quita la fecha de entrega */
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_o, value) => value !== null)
  @Matches(SOLO_FECHA, { message: 'La fecha de entrega debe tener el formato AAAA-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'La fecha de entrega no es válida' })
  fechaEntregaEstimada?: string | null;
}
