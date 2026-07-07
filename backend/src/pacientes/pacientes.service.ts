import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Paciente, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { AuditService } from '../common/audit/audit.service';
import { AuditContext } from '../common/decorators/request-context';
import { paginar, ResultadoPaginado } from '../common/dto/pagination-query.dto';
import { CreatePacienteDto } from './dto/create-paciente.dto';
import { UpdatePacienteDto } from './dto/update-paciente.dto';
import { QueryPacienteDto } from './dto/query-paciente.dto';

export interface PacienteApresentavel {
  id: string;
  nome: string;
  dataNascimento: Date | null;
  contato: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
  anonimizado: boolean;
}

const ANONIMO = '[ANONIMIZADO]';

/**
 * Camada de serviço para o cadastro de Pacientes — a entidade mais sensível
 * do sistema, pois combina identificação pessoal com dados de saúde
 * (associação a exames realizados).
 *
 * Controles de privacy by design aplicados:
 *  - CPF e contato são cifrados em repouso (CryptoService). O CPF NUNCA é
 *    retornado pela API em texto claro (nem em listagens, nem em detalhe) —
 *    a aplicação não tem necessidade operacional de exibi-lo; eventuais
 *    relatórios administrativos específicos poderiam decifrá-lo sob controle
 *    de acesso adicional. Já o contato é decifrado ao apresentar o paciente,
 *    pois é necessário operacionalmente para a equipe da clínica.
 *  - Toda LEITURA individual de um paciente é registrada em audit_logs
 *    (rastreabilidade de acesso a dado de saúde).
 *  - Suporte a anonimização (`anonimizar`) para atender ao direito ao
 *    esquecimento da LGPD, preservando os lançamentos históricos
 *    (necessários para fins contábeis/regulatórios) sem manter PII associada.
 */
@Injectable()
export class PacientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async criar(dto: CreatePacienteDto, ctx: AuditContext): Promise<PacienteApresentavel> {
    const documentoHash = dto.documento ? this.crypto.searchHash(dto.documento) : null;

    if (documentoHash) {
      const existente = await this.prisma.paciente.findUnique({ where: { documentoHash } });
      if (existente) {
        throw new ConflictException('Já existe um paciente cadastrado com este documento.');
      }
    }

    const paciente = await this.prisma.paciente.create({
      data: {
        nome: dto.nome,
        documentoCifrado: dto.documento ? this.crypto.encrypt(dto.documento) : null,
        documentoHash,
        dataNascimento: dto.dataNascimento ? new Date(dto.dataNascimento) : null,
        contatoCifrado: dto.contato ? this.crypto.encrypt(dto.contato) : null,
      },
    });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'CRIACAO',
      entidade: 'Paciente',
      entidadeId: paciente.id,
      dadosNovos: this.paraAuditoria(paciente),
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });

    return this.paraApresentacao(paciente);
  }

  async listar(query: QueryPacienteDto): Promise<ResultadoPaginado<PacienteApresentavel>> {
    const where: Prisma.PacienteWhereInput = {
      deletadoEm: null,
      ...(query.nome ? { nome: { contains: query.nome, mode: 'insensitive' } } : {}),
      ...(query.documento ? { documentoHash: this.crypto.searchHash(query.documento) } : {}),
    };

    const [itens, total] = await this.prisma.$transaction([
      this.prisma.paciente.findMany({
        where,
        orderBy: { nome: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.paciente.count({ where }),
    ]);

    return paginar(
      itens.map((p) => this.paraApresentacao(p)),
      total,
      query.pagina,
      query.tamanhoPagina,
    );
  }

  async buscarPorId(id: string, ctx: AuditContext): Promise<PacienteApresentavel> {
    const paciente = await this.prisma.paciente.findFirst({ where: { id, deletadoEm: null } });
    if (!paciente) {
      throw new NotFoundException('Paciente não encontrado.');
    }

    // Acesso individual a dado de saúde é sempre auditado (accountability/LGPD).
    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'LEITURA',
      entidade: 'Paciente',
      entidadeId: paciente.id,
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });

    return this.paraApresentacao(paciente);
  }

  async atualizar(id: string, dto: UpdatePacienteDto, ctx: AuditContext): Promise<PacienteApresentavel> {
    const atual = await this.prisma.paciente.findFirst({ where: { id, deletadoEm: null } });
    if (!atual) {
      throw new NotFoundException('Paciente não encontrado.');
    }

    const atualizado = await this.prisma.paciente.update({
      where: { id },
      data: {
        nome: dto.nome ?? atual.nome,
        contatoCifrado:
          dto.contato !== undefined
            ? dto.contato
              ? this.crypto.encrypt(dto.contato)
              : null
            : atual.contatoCifrado,
      },
    });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'ATUALIZACAO',
      entidade: 'Paciente',
      entidadeId: id,
      dadosAntigos: this.paraAuditoria(atual),
      dadosNovos: this.paraAuditoria(atualizado),
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });

    return this.paraApresentacao(atualizado);
  }

  async remover(id: string, ctx: AuditContext): Promise<void> {
    const atual = await this.prisma.paciente.findFirst({ where: { id, deletadoEm: null } });
    if (!atual) {
      throw new NotFoundException('Paciente não encontrado.');
    }

    await this.prisma.paciente.update({ where: { id }, data: { deletadoEm: new Date() } });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'EXCLUSAO',
      entidade: 'Paciente',
      entidadeId: id,
      dadosAntigos: this.paraAuditoria(atual),
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });
  }

  /**
   * Implementa o "direito ao esquecimento" (LGPD art. 18): substitui os
   * dados pessoais identificáveis por marcadores irreversíveis, mantendo
   * o registro do paciente (e seus lançamentos históricos) apenas para
   * fins estatísticos/contábeis, sem possibilidade de reidentificação.
   */
  async anonimizar(id: string, ctx: AuditContext): Promise<void> {
    const atual = await this.prisma.paciente.findFirst({ where: { id, deletadoEm: null } });
    if (!atual) {
      throw new NotFoundException('Paciente não encontrado.');
    }
    if (atual.anonimizadoEm) {
      return;
    }

    await this.prisma.paciente.update({
      where: { id },
      data: {
        nome: ANONIMO,
        ...(atual.documentoCifrado
          ? { documentoCifrado: this.crypto.encrypt('00000000000'), documentoHash: `anon:${atual.id}` }
          : {}),
        contatoCifrado: null,
        anonimizadoEm: new Date(),
      },
    });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'ANONIMIZACAO',
      entidade: 'Paciente',
      entidadeId: id,
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });
  }

  private paraApresentacao(paciente: Paciente): PacienteApresentavel {
    return {
      id: paciente.id,
      nome: paciente.nome,
      dataNascimento: paciente.dataNascimento,
      contato: paciente.contatoCifrado ? this.crypto.decrypt(paciente.contatoCifrado) : null,
      criadoEm: paciente.criadoEm,
      atualizadoEm: paciente.atualizadoEm,
      anonimizado: paciente.anonimizadoEm !== null,
    };
  }

  /** Snapshot seguro para audit_logs — nunca inclui CPF/contato, mesmo cifrados. */
  private paraAuditoria(paciente: Paciente): Record<string, unknown> {
    return {
      id: paciente.id,
      nome: paciente.nome,
      anonimizado: paciente.anonimizadoEm !== null,
    };
  }
}
