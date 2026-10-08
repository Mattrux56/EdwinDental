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

export enum TipoRemision {
  NORMAL = 'NORMAL',
  ELECTRONICA = 'ELECTRONICA',
}

export class RemisionItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productoId!: number;

  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad mínima es 1' })
  @Max(999, { message: 'La cantidad máxima por producto es 999' })
  cantidad!: number;
}

export class CreateRemisionDto {
  @IsOptional()
  @IsEnum(TipoRemision)
  tipo?: TipoRemision;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  numero?: number;

  @Type(() => Number)
  @IsInt({ message: 'Selecciona un caso' })
  @Min(1)
  casoId!: number;

  /** YYYY-MM-DD; por defecto, hoy */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener el formato AAAA-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'La fecha no es válida' })
  fecha?: string;

  /** Por defecto, el código del caso */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  noOrden?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Agrega al menos un producto' })
  @ArrayMaxSize(MAX_LINEAS_REMISION, {
    message: `Una remisión admite máximo ${MAX_LINEAS_REMISION} productos`,
  })
  @ValidateNested({ each: true })
  @Type(() => RemisionItemDto)
  items!: RemisionItemDto[];
}
