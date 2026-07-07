import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryPacienteDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca parcial por nome.' })
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiPropertyOptional({ description: 'Busca exata por documento (CPF) — usa hash de busca.' })
  @IsOptional()
  @IsString()
  documento?: string;
}
