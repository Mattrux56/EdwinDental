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

export class CreateCaseDto {
  @Transform(trim)
  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'La orden de trabajo debe contener solo números' })
  codigo!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clienteId?: number;

  /** Obligatorio solo cuando no se elige un cliente existente (clienteId) */
  @ValidateIf((caso: CreateCaseDto) => caso.clienteId === undefined)
  @Transform(trim)
  @IsString({ message: 'El nombre del cliente es obligatorio' })
  @IsNotEmpty({ message: 'El nombre del cliente es obligatorio' })
  @MaxLength(150)
  clienteNombre?: string;

  @Transform(trim)
  @IsString({ message: 'El nombre del paciente es obligatorio' })
  @IsNotEmpty({ message: 'El nombre del paciente es obligatorio' })
  @MaxLength(150)
  pacienteNombre!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre del doctor es obligatorio' })
  @MaxLength(150)
  doctorNombre!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^\d{1,30}$/, { message: 'El número de factura debe contener solo números' })
  numeroFactura?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  descripcion!: string;

  /** YYYY-MM-DD; por defecto, hoy */
  @IsOptional()
  @Transform(trim)
  @Matches(SOLO_FECHA, { message: 'La fecha de ingreso debe tener el formato AAAA-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'La fecha de ingreso no es válida' })
  fechaIngreso?: string;

  /** YYYY-MM-DD */
  @IsOptional()
  @Transform(trim)
  @Matches(SOLO_FECHA, { message: 'La fecha de entrega debe tener el formato AAAA-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'La fecha de entrega no es válida' })
  fechaEntregaEstimada?: string;
}
