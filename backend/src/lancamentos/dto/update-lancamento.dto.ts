import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateLancamentoDto } from './create-lancamento.dto';

/**
 * Técnico, paciente e exame não podem ser alterados após a criação —
 * caso o lançamento esteja incorreto, o fluxo correto é removê-lo
 * (soft delete, preservando a trilha de auditoria) e criar um novo,
 * evitando ambiguidade sobre "o que realmente aconteceu" no histórico.
 */
export class UpdateLancamentoDto extends PartialType(
  OmitType(CreateLancamentoDto, ['tecnicoId', 'pacienteId', 'exameId'] as const),
) {}
