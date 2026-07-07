import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

const PAGE_SIZE_MAX = 100;

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: PAGE_SIZE_MAX })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGE_SIZE_MAX)
  tamanhoPagina: number = 20;

  get skip(): number {
    return (this.pagina - 1) * this.tamanhoPagina;
  }

  get take(): number {
    return this.tamanhoPagina;
  }
}

export interface ResultadoPaginado<T> {
  itens: T[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
  totalPaginas: number;
}

export function paginar<T>(
  itens: T[],
  total: number,
  pagina: number,
  tamanhoPagina: number,
): ResultadoPaginado<T> {
  return {
    itens,
    total,
    pagina,
    tamanhoPagina,
    totalPaginas: Math.max(1, Math.ceil(total / tamanhoPagina)),
  };
}
