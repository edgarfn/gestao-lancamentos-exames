import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryTecnicoDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca parcial por nome.' })
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiPropertyOptional({ description: 'Filtra por situação ativo/inativo.' })
  @IsOptional()
  @IsBooleanString()
  ativo?: string;
}
