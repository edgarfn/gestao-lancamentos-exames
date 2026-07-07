import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryEspecialidadeDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca parcial por nome.' })
  @IsOptional()
  @IsString()
  busca?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  ativo?: string;
}
