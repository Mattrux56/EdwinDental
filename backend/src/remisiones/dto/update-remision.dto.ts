import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MAX_LINEAS_REMISION } from '../remision-excel';
import { RemisionItemDto } from './create-remision.dto';

/** Corrección de una remisión: el número no se puede cambiar */
export class UpdateRemisionDto {
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
