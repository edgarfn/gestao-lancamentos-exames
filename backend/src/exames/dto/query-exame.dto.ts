import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryExameDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca parcial por nome ou código.' })
  @IsOptional()
  @IsString()
  busca?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  ativo?: string;
}
