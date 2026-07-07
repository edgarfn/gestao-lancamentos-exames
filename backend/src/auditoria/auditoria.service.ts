import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { paginar, ResultadoPaginado } from '../common/dto/pagination-query.dto';
import { QueryAuditoriaDto } from './dto/query-auditoria.dto';

const INCLUDE_OPERADOR = {
  usuario: { select: { id: true, nome: true, email: true } },
} satisfies Prisma.AuditLogInclude;

type AuditLogComOperador = Prisma.AuditLogGetPayload<{ include: typeof INCLUDE_OPERADOR }>;

export interface AuditoriaApresentavel {
  id: string;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  operador: { id: string; nome: string; email: string } | null;
  dadosAntigos: Record<string, unknown> | null;
  dadosNovos: Record<string, unknown> | null;
  enderecoIp: string | null;
  enderecoIpProxy: string | null;
  userAgent: string | null;
  criadoEm: Date;
}

/**
 * Consulta de leitura sobre a trilha de auditoria — não grava nem altera
 * eventos (a tabela "audit_logs" é somente-inserção, ver AuditService).
 * Permite a um administrador localizar e revisar operações realizadas no
 * sistema (quem, quando, o quê) por operador, tipo de operação, cadastro
 * afetado e período, atendendo ao princípio de responsabilização (LGPD).
 */
@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: QueryAuditoriaDto): Promise<ResultadoPaginado<AuditoriaApresentavel>> {
    const where = this.construirFiltro(query);

    const [itens, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: INCLUDE_OPERADOR,
        orderBy: { criadoEm: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginar(
      itens.map((item) => this.paraApresentacao(item)),
      total,
      query.pagina,
      query.tamanhoPagina,
    );
  }

  /** Lista enxuta de cadastros de eventos distintos — alimenta o seletor de "tipo de cadastro" no filtro. */
  async listarEntidades(): Promise<string[]> {
    const linhas = await this.prisma.auditLog.findMany({
      distinct: ['entidade'],
      select: { entidade: true },
      orderBy: { entidade: 'asc' },
    });
    return linhas.map((linha) => linha.entidade);
  }

  private construirFiltro(query: QueryAuditoriaDto): Prisma.AuditLogWhereInput {
    const filtroData: Prisma.DateTimeFilter = {};
    if (query.dataInicio) {
      filtroData.gte = new Date(`${query.dataInicio}T00:00:00.000Z`);
    }
    if (query.dataFim) {
      filtroData.lte = new Date(`${query.dataFim}T23:59:59.999Z`);
    }

    return {
      ...(query.usuarioId ? { usuarioId: query.usuarioId } : {}),
      ...(query.acao ? { acao: query.acao } : {}),
      ...(query.entidade ? { entidade: query.entidade } : {}),
      ...(Object.keys(filtroData).length > 0 ? { criadoEm: filtroData } : {}),
    };
  }

  private paraApresentacao(item: AuditLogComOperador): AuditoriaApresentavel {
    return {
      id: item.id,
      acao: item.acao,
      entidade: item.entidade,
      entidadeId: item.entidadeId,
      operador: item.usuario,
      dadosAntigos: item.dadosAntigos as Record<string, unknown> | null,
      dadosNovos: item.dadosNovos as Record<string, unknown> | null,
      enderecoIp: item.enderecoIp,
      enderecoIpProxy: item.enderecoIpProxy,
      userAgent: item.userAgent,
      criadoEm: item.criadoEm,
    };
  }
}
