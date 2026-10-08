import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_LINEAS_REMISION } from '../remision-excel';
import { RemisionItemDto, TipoRemision } from './create-remision.dto';

/** Corrección de una remisión existente */
export class UpdateRemisionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  numero?: number;

  @IsOptional()
  @IsEnum(TipoRemision)
  tipo?: TipoRemision;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener el formato AAAA-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'La fecha no es válida' })
  fecha?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  noOrden?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  doctorNombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  pacienteNombre?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Agrega al menos un producto' })
  @ArrayMaxSize(MAX_LINEAS_REMISION, { message: `Una remisión admite máximo ${MAX_LINEAS_REMISION} productos` })
  @ValidateNested({ each: true })
  @Type(() => RemisionItemDto)
  items?: RemisionItemDto[];
}
