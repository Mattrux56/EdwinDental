import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';

export class CreateProductoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  codigo!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  categoria!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  descripcion!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000, { message: 'El valor máximo permitido es 100.000.000' })
  valor!: number;
}
