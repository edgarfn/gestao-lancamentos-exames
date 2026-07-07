import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateEspecialidadeDto {
  @ApiProperty({ example: 'Hematologia' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nome!: string;

  @ApiPropertyOptional({ example: 'Exames relacionados ao sangue e tecidos hematopoéticos.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
