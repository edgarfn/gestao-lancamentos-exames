import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuditContext } from '../common/decorators/request-context';
import { paginar, ResultadoPaginado } from '../common/dto/pagination-query.dto';
import { CreateLancamentoDto } from './dto/create-lancamento.dto';
import { UpdateLancamentoDto } from './dto/update-lancamento.dto';
import { QueryLancamentoDto } from './dto/query-lancamento.dto';
import { QueryEvolucaoMensalDto } from './dto/query-evolucao-mensal.dto';

const INCLUDE_RELACOES = {
  tecnico: { select: { id: true, nome: true } },
  paciente: { select: { id: true, nome: true } },
  exame: {
    select: {
      id: true,
      nome: true,
      codigo: true,
      especialidade: { select: { id: true, nome: true } },
    },
  },
  convenio: { select: { id: true, nome: true } },
} satisfies Prisma.LancamentoInclude;

type LancamentoComRelacoes = Prisma.LancamentoGetPayload<{ include: typeof INCLUDE_RELACOES }>;

export interface LancamentoApresentavel {
  id: string;
  data: Date;
  quantidade: number;
  valor: string;
  observacoes: string | null;
  tecnico: { id: string; nome: string };
  paciente: { id: string; nome: string };
  exame: { id: string; nome: string; codigo: string; especialidade: { id: string; nome: string } | null };
  convenio: { id: string; nome: string } | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface ResumoLancamentos {
  totalRegistros: number;
  quantidadeTotal: number;
  valorTotal: string;
}

export interface PontoEvolucaoMensal {
  mes: string;
  rotulo: string;
  faturamento: string;
  quantidade: number;
}

/**
 * Núcleo funcional do sistema: CRUD de lançamentos (Técnico + Paciente +
 * Exame + Data + Quantidade + Valor) com os filtros de consulta solicitados
 * (exame, técnico, data, paciente), todos resolvidos por índices dedicados
 * no schema Prisma para manter a consulta performática mesmo com grande volume.
 */
@Injectable()
export class LancamentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async criar(
    dto: CreateLancamentoDto,
    criadoPorId: string,
    ctx: AuditContext,
  ): Promise<LancamentoApresentavel> {
    await this.garantirReferenciasValidas(dto.tecnicoId, dto.pacienteId, dto.exameId);

    const lancamento = await this.prisma.lancamento.create({
      data: {
        tecnicoId: dto.tecnicoId,
        pacienteId: dto.pacienteId,
        exameId: dto.exameId,
        convenioId: dto.convenioId ?? null,
        data: new Date(dto.data),
        quantidade: dto.quantidade,
        valor: dto.valor,
        observacoes: dto.observacoes,
        criadoPorId,
      },
      include: INCLUDE_RELACOES,
    });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'CRIACAO',
      entidade: 'Lancamento',
      entidadeId: lancamento.id,
      dadosNovos: this.paraAuditoria(lancamento),
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });

    return this.paraApresentacao(lancamento);
  }

  async listar(query: QueryLancamentoDto): Promise<ResultadoPaginado<LancamentoApresentavel>> {
    const where = this.construirFiltro(query);
    const orderBy = this.construirOrdenacao(query.ordenarPor);

    const [itens, total] = await this.prisma.$transaction([
      this.prisma.lancamento.findMany({
        where,
        include: INCLUDE_RELACOES,
        orderBy,
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.lancamento.count({ where }),
    ]);

    return paginar(
      itens.map((l) => this.paraApresentacao(l)),
      total,
      query.pagina,
      query.tamanhoPagina,
    );
  }

  async buscarPorId(id: string): Promise<LancamentoApresentavel> {
    const lancamento = await this.prisma.lancamento.findFirst({
      where: { id, deletadoEm: null },
      include: INCLUDE_RELACOES,
    });
    if (!lancamento) {
      throw new NotFoundException('Lançamento não encontrado.');
    }
    return this.paraApresentacao(lancamento);
  }

  async atualizar(id: string, dto: UpdateLancamentoDto, ctx: AuditContext): Promise<LancamentoApresentavel> {
    const atual = await this.prisma.lancamento.findFirst({
      where: { id, deletadoEm: null },
      include: INCLUDE_RELACOES,
    });
    if (!atual) {
      throw new NotFoundException('Lançamento não encontrado.');
    }

    const atualizado = await this.prisma.lancamento.update({
      where: { id },
      data: {
        data: dto.data ? new Date(dto.data) : undefined,
        quantidade: dto.quantidade,
        valor: dto.valor,
        observacoes: dto.observacoes,
      },
      include: INCLUDE_RELACOES,
    });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'ATUALIZACAO',
      entidade: 'Lancamento',
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
    const atual = await this.prisma.lancamento.findFirst({
      where: { id, deletadoEm: null },
      include: INCLUDE_RELACOES,
    });
    if (!atual) {
      throw new NotFoundException('Lançamento não encontrado.');
    }

    await this.prisma.lancamento.update({ where: { id }, data: { deletadoEm: new Date() } });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'EXCLUSAO',
      entidade: 'Lancamento',
      entidadeId: id,
      dadosAntigos: this.paraAuditoria(atual),
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });
  }

  /** Agregados (totais) sobre o mesmo conjunto filtrado — alimenta o dashboard. */
  async resumo(query: QueryLancamentoDto): Promise<ResumoLancamentos> {
    const where = this.construirFiltro(query);
    const agregados = await this.prisma.lancamento.aggregate({
      where,
      _count: { _all: true },
      _sum: { quantidade: true, valor: true },
    });

    return {
      totalRegistros: agregados._count._all,
      quantidadeTotal: agregados._sum.quantidade ?? 0,
      valorTotal: (agregados._sum.valor ?? new Prisma.Decimal(0)).toFixed(2),
    };
  }

  /**
   * Exporta os lançamentos filtrados em CSV. Não pagina (respeita o filtro
   * por completo), mas o chamador deve registrar o evento de auditoria
   * EXPORTACAO — exportações em massa de dados associados a pacientes são
   * um ponto de atenção de privacidade (ver LancamentosController).
   */
  async listarParaExportacao(query: QueryLancamentoDto, limite: number): Promise<LancamentoApresentavel[]> {
    const where = this.construirFiltro(query);
    const orderBy = this.construirOrdenacao(query.ordenarPor);
    const itens = await this.prisma.lancamento.findMany({
      where,
      include: INCLUDE_RELACOES,
      orderBy,
      take: limite,
    });
    return itens.map((l) => this.paraApresentacao(l));
  }

  /**
   * Resolve os identificadores do filtro (IDs) para nomes legíveis, usados
   * no cabeçalho do relatório PDF — evita expor UUIDs ao usuário final.
   */
  async resolverRotulosFiltro(query: QueryLancamentoDto): Promise<{
    tecnico: string | null;
    exame: string | null;
    paciente: string | null;
    especialidade: string | null;
    convenio: string | null;
  }> {
    const [tecnico, exame, paciente, especialidade, convenio] = await Promise.all([
      query.tecnicoId
        ? this.prisma.tecnico.findUnique({ where: { id: query.tecnicoId }, select: { nome: true } })
        : null,
      query.exameId
        ? this.prisma.exame.findUnique({ where: { id: query.exameId }, select: { nome: true, codigo: true } })
        : null,
      query.pacienteId
        ? this.prisma.paciente.findUnique({ where: { id: query.pacienteId }, select: { nome: true } })
        : null,
      query.especialidadeId
        ? this.prisma.especialidade.findUnique({ where: { id: query.especialidadeId }, select: { nome: true } })
        : null,
      query.convenioId
        ? this.prisma.convenio.findUnique({ where: { id: query.convenioId }, select: { nome: true } })
        : null,
    ]);

    return {
      tecnico: tecnico?.nome ?? null,
      exame: exame ? `${exame.nome} (${exame.codigo})` : null,
      paciente: paciente?.nome ?? null,
      especialidade: especialidade?.nome ?? null,
      convenio: convenio?.nome ?? null,
    };
  }

  /**
   * Retorna os 12 meses anteriores (incluindo o mês atual) com o total de
   * faturamento e quantidade de exames realizados por mês. Meses sem dados
   * são preenchidos com zeros para garantir uma série contínua no gráfico.
   */
  async evolucaoMensal(query: QueryEvolucaoMensalDto): Promise<PontoEvolucaoMensal[]> {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    const filtroTecnico = query.tecnicoId
      ? Prisma.sql`AND l.tecnico_id = ${query.tecnicoId}`
      : Prisma.empty;

    const filtroEspecialidade = query.especialidadeId
      ? Prisma.sql`AND l.exame_id IN (
          SELECT id FROM exames WHERE especialidade_id = ${query.especialidadeId} AND deletado_em IS NULL
        )`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<{ mes: string; faturamento: string; quantidade: bigint }[]>`
      SELECT
        TO_CHAR(l.data, 'YYYY-MM') AS mes,
        COALESCE(SUM(l.valor), 0)::text AS faturamento,
        COALESCE(SUM(l.quantidade), 0)::bigint AS quantidade
      FROM lancamentos l
      WHERE l.deletado_em IS NULL
        AND l.data >= ${inicio}
        AND l.data <= ${fim}
        ${filtroTecnico}
        ${filtroEspecialidade}
      GROUP BY TO_CHAR(l.data, 'YYYY-MM')
      ORDER BY mes ASC
    `;

    const mapa = new Map(rows.map((r) => [r.mes, r]));
    const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const pontos: PontoEvolucaoMensal[] = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const dado = mapa.get(mesKey);
      pontos.push({
        mes: mesKey,
        rotulo: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        faturamento: dado ? Number(dado.faturamento).toFixed(2) : '0.00',
        quantidade: dado ? Number(dado.quantidade) : 0,
      });
    }

    return pontos;
  }

  private construirFiltro(query: QueryLancamentoDto): Prisma.LancamentoWhereInput {
    const filtroData: Prisma.DateTimeFilter = {};
    if (query.dataInicio) {
      filtroData.gte = new Date(query.dataInicio);
    }
    if (query.dataFim) {
      filtroData.lte = new Date(query.dataFim);
    }

    return {
      deletadoEm: null,
      ...(query.exameId ? { exameId: query.exameId } : {}),
      ...(query.tecnicoId ? { tecnicoId: query.tecnicoId } : {}),
      ...(query.pacienteId ? { pacienteId: query.pacienteId } : {}),
      ...(query.especialidadeId ? { exame: { especialidadeId: query.especialidadeId } } : {}),
      ...(query.convenioId ? { convenioId: query.convenioId } : {}),
      ...(Object.keys(filtroData).length > 0 ? { data: filtroData } : {}),
    };
  }

  private construirOrdenacao(
    ordenarPor: QueryLancamentoDto['ordenarPor'],
  ): Prisma.LancamentoOrderByWithRelationInput {
    const campo = ordenarPor?.replace(/^-/, '') ?? 'data';
    const direcao: Prisma.SortOrder = ordenarPor?.startsWith('-') ? 'desc' : 'asc';
    return { [campo]: direcao } as Prisma.LancamentoOrderByWithRelationInput;
  }

  private async garantirReferenciasValidas(
    tecnicoId: string,
    pacienteId: string,
    exameId: string,
  ): Promise<void> {
    const [tecnico, paciente, exame] = await Promise.all([
      this.prisma.tecnico.findFirst({ where: { id: tecnicoId, deletadoEm: null, ativo: true } }),
      this.prisma.paciente.findFirst({ where: { id: pacienteId, deletadoEm: null } }),
      this.prisma.exame.findFirst({ where: { id: exameId, deletadoEm: null, ativo: true } }),
    ]);

    if (!tecnico) throw new NotFoundException('Técnico inválido, inativo ou não encontrado.');
    if (!paciente) throw new NotFoundException('Paciente inválido ou não encontrado.');
    if (!exame) throw new NotFoundException('Exame inválido, inativo ou não encontrado.');
  }

  private paraApresentacao(lancamento: LancamentoComRelacoes): LancamentoApresentavel {
    return {
      id: lancamento.id,
      data: lancamento.data,
      quantidade: lancamento.quantidade,
      valor: lancamento.valor.toFixed(2),
      observacoes: lancamento.observacoes,
      tecnico: lancamento.tecnico,
      paciente: lancamento.paciente,
      exame: {
        id: lancamento.exame.id,
        nome: lancamento.exame.nome,
        codigo: lancamento.exame.codigo,
        especialidade: lancamento.exame.especialidade ?? null,
      },
      convenio: lancamento.convenio ?? null,
      criadoEm: lancamento.criadoEm,
      atualizadoEm: lancamento.atualizadoEm,
    };
  }

  /** Snapshot serializável para audit_logs — apenas identificadores e valores não sensíveis. */
  private paraAuditoria(lancamento: LancamentoComRelacoes): Record<string, unknown> {
    return {
      id: lancamento.id,
      tecnicoId: lancamento.tecnicoId,
      pacienteId: lancamento.pacienteId,
      exameId: lancamento.exameId,
      convenioId: lancamento.convenioId ?? null,
      data: lancamento.data.toISOString().slice(0, 10),
      quantidade: lancamento.quantidade,
      valor: lancamento.valor.toFixed(2),
    };
  }
}
