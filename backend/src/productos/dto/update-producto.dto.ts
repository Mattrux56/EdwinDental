import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateProductoDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  codigo?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  categoria?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  descripcion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000, { message: 'El valor máximo permitido es 100.000.000' })
  valor?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
