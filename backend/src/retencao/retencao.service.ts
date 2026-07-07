import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { AuditService } from '../common/audit/audit.service';

const ANONIMO = '[ANONIMIZADO POR POLÍTICA DE RETENÇÃO]';

/**
 * Job agendado de retenção/anonimização de dados — implementa o princípio
 * de "limitação de armazenamento" da LGPD (art. 6º, VII): pacientes sem
 * nenhum lançamento associado nos últimos N dias (configurável via
 * DATA_RETENTION_DAYS) têm seus dados pessoais identificáveis anonimizados
 * de forma irreversível, mantendo apenas o necessário para fins
 * estatísticos/contábeis (associações já existentes em "lancamentos").
 *
 * Roda diariamente às 03h (baixa atividade). Cada execução é registrada
 * em audit_logs como evento ANONIMIZACAO, permitindo auditoria do próprio
 * processo automatizado.
 */
@Injectable()
export class RetencaoService {
  private readonly logger = new Logger(RetencaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async executarAnonimizacaoProgramada(): Promise<void> {
    const dias = this.config.get<number>('DATA_RETENTION_DAYS') ?? 1825;
    const limite = new Date();
    limite.setDate(limite.getDate() - dias);

    const candidatos = await this.prisma.paciente.findMany({
      where: {
        deletadoEm: null,
        anonimizadoEm: null,
        // Apenas pacientes com histórico (some) cujo último lançamento já
        // ultrapassou o prazo de retenção (every ... lt limite) são elegíveis.
        lancamentos: {
          some: {},
          every: { data: { lt: limite } },
        },
      },
      select: { id: true, documentoCifrado: true },
      take: 500,
    });

    if (candidatos.length === 0) {
      this.logger.log('Rotina de retenção: nenhum paciente elegível para anonimização hoje.');
      return;
    }

    let anonimizados = 0;
    for (const candidato of candidatos) {
      await this.anonimizarPaciente(candidato);
      anonimizados += 1;
    }

    this.logger.log(`Rotina de retenção: ${anonimizados} paciente(s) anonimizado(s) automaticamente.`);
  }

  private async anonimizarPaciente(paciente: { id: string; documentoCifrado: string | null }): Promise<void> {
    const { id } = paciente;

    await this.prisma.paciente.update({
      where: { id },
      data: {
        nome: ANONIMO,
        ...(paciente.documentoCifrado
          ? {
              documentoCifrado: this.crypto.encrypt('00000000000'),
              documentoHash: `anon-retencao:${createHash('sha256').update(id).digest('hex')}`,
            }
          : {}),
        contatoCifrado: null,
        anonimizadoEm: new Date(),
      },
    });

    await this.audit.registrar({
      usuarioId: null,
      acao: 'ANONIMIZACAO',
      entidade: 'Paciente',
      entidadeId: id,
      dadosNovos: { motivo: 'politica_de_retencao_automatica' },
    });
  }
}
