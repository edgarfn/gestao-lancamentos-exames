import { Injectable, Logger } from '@nestjs/common';
import { AcaoAuditoria, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RegistrarAuditoriaParams {
  usuarioId?: string | null;
  acao: AcaoAuditoria;
  entidade: string;
  entidadeId?: string | null;
  dadosAntigos?: Record<string, unknown> | null;
  dadosNovos?: Record<string, unknown> | null;
  /** IP real do cliente (resolvido via X-Forwarded-For com trust proxy). */
  enderecoIp?: string | null;
  /** IP direto da conexão TCP — normalmente o proxy reverso ou container. */
  enderecoIpProxy?: string | null;
  userAgent?: string | null;
}

/**
 * Centraliza a gravação de eventos de auditoria. A tabela "audit_logs" é
 * somente-inserção (sem update/delete), funcionando como trilha imutável
 * para fins de responsabilização (accountability — princípio da LGPD).
 *
 * IMPORTANTE: nunca registrar aqui o conteúdo de campos pessoais sensíveis
 * em texto claro (ex.: CPF, contato). Os snapshots "dadosAntigos"/"dadosNovos"
 * devem conter apenas identificadores e campos não sensíveis — ver os
 * métodos `paraAuditoria()` nos serviços de domínio.
 *
 * Falhas ao gravar auditoria são logadas mas não interrompem a operação de
 * negócio (a indisponibilidade do log de auditoria não deve bloquear o
 * atendimento), porém são tratadas como incidente operacional a investigar.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registrar(params: RegistrarAuditoriaParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          usuarioId: params.usuarioId ?? null,
          acao: params.acao,
          entidade: params.entidade,
          entidadeId: params.entidadeId ?? null,
          dadosAntigos: (params.dadosAntigos ?? undefined) as Prisma.InputJsonValue | undefined,
          dadosNovos: (params.dadosNovos ?? undefined) as Prisma.InputJsonValue | undefined,
          enderecoIp: params.enderecoIp ?? null,
          enderecoIpProxy: params.enderecoIpProxy ?? null,
          userAgent: params.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        { err: error as Error, acao: params.acao, entidade: params.entidade },
        'Falha ao registrar evento de auditoria',
      );
    }
  }
}
