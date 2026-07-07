import { ApiPropertyOptional } from '@nestjs/swagger';
import { AcaoAuditoria } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * DTO de filtros de consulta da trilha de auditoria — permite localizar
 * eventos por operador (usuário responsável), tipo de operação realizada
 * (criação/alteração/exclusão/etc.), tipo de cadastro afetado e período.
 *
 * Todos os filtros são validados antes de chegar ao banco (UUID/enum/ISO-date),
 * prevenindo injeção e consultas malformadas — a trilha em si é somente-leitura
 * por esta via (a gravação ocorre exclusivamente via AuditService).
 */
export class QueryAuditoriaDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtra pelo ID do usuário responsável pela operação.' })
  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @ApiPropertyOptional({ enum: AcaoAuditoria, description: 'Filtra pelo tipo de operação realizada.' })
  @IsOptional()
  @IsEnum(AcaoAuditoria, { message: 'Operação inválida.' })
  acao?: AcaoAuditoria;

  @ApiPropertyOptional({
    description: 'Filtra pelo tipo de cadastro afetado (ex.: Tecnico, Paciente, Exame, Lancamento, Usuario).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entidade?: string;

  @ApiPropertyOptional({ example: '2026-06-01', description: 'Início do intervalo de datas (inclusivo).' })
  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @ApiPropertyOptional({ example: '2026-06-30', description: 'Fim do intervalo de datas (inclusivo).' })
  @IsOptional()
  @IsDateString()
  dataFim?: string;
}
