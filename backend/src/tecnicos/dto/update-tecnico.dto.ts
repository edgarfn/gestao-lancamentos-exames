import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateTecnicoDto } from './create-tecnico.dto';

/**
 * O documento (CPF) não pode ser alterado via update — é um identificador
 * estável usado para deduplicação (hash único). Para corrigir um cadastro
 * com documento incorreto, o fluxo correto é inativar e recriar, preservando
 * a trilha de auditoria.
 */
export class UpdateTecnicoDto extends PartialType(OmitType(CreateTecnicoDto, ['documento'] as const)) {}
