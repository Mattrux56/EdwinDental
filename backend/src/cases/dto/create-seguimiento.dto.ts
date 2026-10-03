import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const ESTADOS_CASO = ['En Laboratorio', 'En Proceso', 'Finalizado'] as const;

export class CreateSeguimientoDto {
  @IsString()
  @IsNotEmpty({ message: 'La descripción del seguimiento es obligatoria' })
  @MaxLength(5000)
  descripcion: string;

  /** Tipo del seguimiento (por defecto "Reingreso") */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  tipo?: string;

  /** Si se envía, actualiza el estado del caso */
  @IsOptional()
  @IsIn(ESTADOS_CASO as unknown as string[], {
    message: `El estado debe ser uno de: ${ESTADOS_CASO.join(', ')}`,
  })
  estado?: string;
}
