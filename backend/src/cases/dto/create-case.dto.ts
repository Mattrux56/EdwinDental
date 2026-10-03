import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCaseDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del cliente es obligatorio' })
  @MaxLength(150)
  clienteNombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentoIdentidad?: string;

  @IsString()
  @IsNotEmpty({ message: 'El título del caso es obligatorio' })
  @MaxLength(200)
  titulo: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción del ingreso es obligatoria' })
  @MaxLength(5000)
  descripcion: string;

  /** Tipo del primer seguimiento (por defecto "Ingreso Inicial") */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  tipo?: string;
}
