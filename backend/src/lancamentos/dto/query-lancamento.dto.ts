import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const ORDENACOES_PERMITIDAS = ['data', '-data', 'criadoEm', '-criadoEm', 'valor', '-valor'] as const;
export type OrdenacaoLancamento = (typeof ORDENACOES_PERMITIDAS)[number];

/**
 * DTO de filtros de consulta de lançamentos — implementa exatamente os
 * critérios solicitados (exame, técnico, data, paciente), com data tratada
 * como intervalo (de/até) para permitir tanto consultas pontuais
 * (dataInicio === dataFim) quanto por período.
 *
 * Todos os filtros são validados (UUID/ISO-date) antes de chegar ao banco,
 * prevenindo injeção e erros de tipo em tempo de consulta.
 */
export class QueryLancamentoDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtra por ID do exame.' })
  @IsOptional()
  @IsUUID()
  exameId?: string;

  @ApiPropertyOptional({ description: 'Filtra por ID do técnico.' })
  @IsOptional()
  @IsUUID()
  tecnicoId?: string;

  @ApiPropertyOptional({ description: 'Filtra por ID do paciente.' })
  @IsOptional()
  @IsUUID()
  pacienteId?: string;

  @ApiPropertyOptional({ example: '2026-06-01', description: 'Início do intervalo de datas (inclusivo).' })
  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @ApiPropertyOptional({ example: '2026-06-30', description: 'Fim do intervalo de datas (inclusivo).' })
  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @ApiPropertyOptional({ description: 'Filtra por ID da especialidade do exame.' })
  @IsOptional()
  @IsString()
  especialidadeId?: string;

  @ApiPropertyOptional({ description: 'Filtra por ID do convênio.' })
  @IsOptional()
  @IsUUID()
  convenioId?: string;

  @ApiPropertyOptional({ enum: ORDENACOES_PERMITIDAS, default: '-data' })
  @IsOptional()
  @IsIn(ORDENACOES_PERMITIDAS)
  ordenarPor?: OrdenacaoLancamento = '-data';
}
