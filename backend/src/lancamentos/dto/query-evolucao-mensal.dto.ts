import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class QueryEvolucaoMensalDto {
  @ApiPropertyOptional({ description: 'Filtra pelos lançamentos de um técnico específico.' })
  @IsOptional()
  @IsString()
  tecnicoId?: string;

  @ApiPropertyOptional({ description: 'Filtra pelos exames de uma especialidade específica.' })
  @IsOptional()
  @IsString()
  especialidadeId?: string;
}
