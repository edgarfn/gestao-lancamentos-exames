import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LancamentosService } from './lancamentos.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import type { QueryLancamentoDto } from './dto/query-lancamento.dto';

function criarQuery(parcial: Partial<QueryLancamentoDto> = {}): QueryLancamentoDto {
  return {
    pagina: 1,
    tamanhoPagina: 20,
    skip: 0,
    take: 20,
    ordenarPor: '-data',
    ...parcial,
  } as QueryLancamentoDto;
}

const RELACOES_BASE = {
  tecnico: { id: 'tecnico-1', nome: 'Ana Técnica' },
  paciente: { id: 'paciente-1', nome: 'João Paciente' },
  exame: { id: 'exame-1', nome: 'Hemograma completo', codigo: 'HEMO-001' },
};

function criarLancamentoPrisma(parcial: Record<string, unknown> = {}) {
  return {
    id: 'lancamento-1',
    tecnicoId: 'tecnico-1',
    pacienteId: 'paciente-1',
    exameId: 'exame-1',
    data: new Date('2026-01-15T00:00:00.000Z'),
    quantidade: 2,
    valor: new Prisma.Decimal('150.00'),
    observacoes: null,
    criadoPorId: 'user-1',
    criadoEm: new Date('2026-01-15T10:00:00.000Z'),
    atualizadoEm: new Date('2026-01-15T10:00:00.000Z'),
    deletadoEm: null,
    ...RELACOES_BASE,
    ...parcial,
  };
}

describe('LancamentosService', () => {
  let prisma: {
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
    lancamento: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      aggregate: jest.Mock;
    };
    tecnico: { findFirst: jest.Mock };
    paciente: { findFirst: jest.Mock };
    exame: { findFirst: jest.Mock };
  };
  let audit: { registrar: jest.Mock };
  let service: LancamentosService;

  const ctx = { usuarioId: 'user-1', enderecoIp: '127.0.0.1', enderecoIpProxy: null, userAgent: 'jest' };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
      lancamento: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      tecnico: { findFirst: jest.fn() },
      paciente: { findFirst: jest.fn() },
      exame: { findFirst: jest.fn() },
    };
    audit = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new LancamentosService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  });

  describe('listar — construção dos filtros de consulta (exame, técnico, data, paciente)', () => {
    it('aplica somente o filtro "deletadoEm: null" quando nenhum critério é informado', async () => {
      prisma.$transaction.mockImplementation(async (operacoes: unknown[]) =>
        Promise.all(operacoes as Promise<unknown>[]),
      );
      prisma.lancamento.findMany.mockResolvedValue([]);
      prisma.lancamento.count.mockResolvedValue(0);

      await service.listar(criarQuery());

      expect(prisma.lancamento.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletadoEm: null } }),
      );
    });

    it('combina os quatro filtros solicitados (exame, técnico, paciente e intervalo de datas)', async () => {
      prisma.$transaction.mockImplementation(async (operacoes: unknown[]) =>
        Promise.all(operacoes as Promise<unknown>[]),
      );
      prisma.lancamento.findMany.mockResolvedValue([]);
      prisma.lancamento.count.mockResolvedValue(0);

      await service.listar(
        criarQuery({
          exameId: 'exame-9',
          tecnicoId: 'tecnico-9',
          pacienteId: 'paciente-9',
          dataInicio: '2026-01-01',
          dataFim: '2026-01-31',
        }),
      );

      expect(prisma.lancamento.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletadoEm: null,
            exameId: 'exame-9',
            tecnicoId: 'tecnico-9',
            pacienteId: 'paciente-9',
            data: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') },
          },
        }),
      );
    });

    it('aceita filtro de data com apenas início ou apenas fim (intervalo aberto)', async () => {
      prisma.$transaction.mockImplementation(async (operacoes: unknown[]) =>
        Promise.all(operacoes as Promise<unknown>[]),
      );
      prisma.lancamento.findMany.mockResolvedValue([]);
      prisma.lancamento.count.mockResolvedValue(0);

      await service.listar(criarQuery({ dataInicio: '2026-02-01' }));

      expect(prisma.lancamento.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletadoEm: null, data: { gte: new Date('2026-02-01') } } }),
      );
    });

    it('traduz "ordenarPor" com prefixo "-" para ordenação descendente, e sem prefixo para ascendente', async () => {
      prisma.$transaction.mockImplementation(async (operacoes: unknown[]) =>
        Promise.all(operacoes as Promise<unknown>[]),
      );
      prisma.lancamento.findMany.mockResolvedValue([]);
      prisma.lancamento.count.mockResolvedValue(0);

      await service.listar(criarQuery({ ordenarPor: '-data' }));
      expect(prisma.lancamento.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ orderBy: { data: 'desc' } }),
      );

      await service.listar(criarQuery({ ordenarPor: 'valor' }));
      expect(prisma.lancamento.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ orderBy: { valor: 'asc' } }),
      );
    });

    it('pagina os resultados com base em "skip"/"take" e retorna metadados de paginação', async () => {
      prisma.$transaction.mockImplementation(async (operacoes: unknown[]) =>
        Promise.all(operacoes as Promise<unknown>[]),
      );
      prisma.lancamento.findMany.mockResolvedValue([criarLancamentoPrisma()]);
      prisma.lancamento.count.mockResolvedValue(37);

      const resultado = await service.listar(
        criarQuery({ pagina: 2, tamanhoPagina: 10, skip: 10, take: 10 }),
      );

      expect(prisma.lancamento.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(resultado).toMatchObject({ total: 37, pagina: 2, tamanhoPagina: 10, totalPaginas: 4 });
      expect(resultado.itens[0].valor).toBe('150.00');
    });
  });

  describe('resumo', () => {
    it('agrega total de registros, quantidade e valor sobre o mesmo filtro usado na listagem', async () => {
      prisma.lancamento.aggregate.mockResolvedValue({
        _count: { _all: 5 },
        _sum: { quantidade: 12, valor: new Prisma.Decimal('999.90') },
      });

      const resumo = await service.resumo(criarQuery({ tecnicoId: 'tecnico-9' }));

      expect(prisma.lancamento.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletadoEm: null, tecnicoId: 'tecnico-9' } }),
      );
      expect(resumo).toEqual({ totalRegistros: 5, quantidadeTotal: 12, valorTotal: '999.90' });
    });

    it('retorna zeros quando não há lançamentos no filtro', async () => {
      prisma.lancamento.aggregate.mockResolvedValue({
        _count: { _all: 0 },
        _sum: { quantidade: null, valor: null },
      });

      const resumo = await service.resumo(criarQuery());

      expect(resumo).toEqual({ totalRegistros: 0, quantidadeTotal: 0, valorTotal: '0.00' });
    });
  });

  describe('criar', () => {
    it('rejeita quando o técnico, paciente ou exame referenciado é inválido', async () => {
      prisma.tecnico.findFirst.mockResolvedValue(null);
      prisma.paciente.findFirst.mockResolvedValue({ id: 'paciente-1' });
      prisma.exame.findFirst.mockResolvedValue({ id: 'exame-1' });

      await expect(
        service.criar(
          {
            tecnicoId: 'tecnico-1',
            pacienteId: 'paciente-1',
            exameId: 'exame-1',
            data: '2026-01-15',
            quantidade: 1,
            valor: '10.00',
          },
          'user-1',
          ctx,
        ),
      ).rejects.toThrow('Técnico inválido, inativo ou não encontrado.');
      expect(prisma.lancamento.create).not.toHaveBeenCalled();
    });

    it('cria o lançamento, registra auditoria de CRIACAO e retorna a apresentação formatada', async () => {
      prisma.tecnico.findFirst.mockResolvedValue({ id: 'tecnico-1' });
      prisma.paciente.findFirst.mockResolvedValue({ id: 'paciente-1' });
      prisma.exame.findFirst.mockResolvedValue({ id: 'exame-1' });
      prisma.lancamento.create.mockResolvedValue(criarLancamentoPrisma());

      const resultado = await service.criar(
        {
          tecnicoId: 'tecnico-1',
          pacienteId: 'paciente-1',
          exameId: 'exame-1',
          data: '2026-01-15',
          quantidade: 2,
          valor: '150.00',
        },
        'user-1',
        ctx,
      );

      expect(resultado.valor).toBe('150.00');
      expect(resultado.tecnico).toEqual(RELACOES_BASE.tecnico);
      expect(audit.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: 'CRIACAO', entidade: 'Lancamento', usuarioId: 'user-1' }),
      );
      const dadosNovos = audit.registrar.mock.calls[0][0].dadosNovos;
      expect(dadosNovos.valor).toBe('150.00');
      expect(typeof dadosNovos.valor).toBe('string');
    });
  });

  describe('remover', () => {
    it('lança NotFoundException quando o lançamento não existe ou já foi removido', async () => {
      prisma.lancamento.findFirst.mockResolvedValue(null);

      await expect(service.remover('id-inexistente', ctx)).rejects.toThrow(NotFoundException);
      expect(prisma.lancamento.update).not.toHaveBeenCalled();
    });

    it('aplica soft delete (preenchendo deletadoEm) e registra auditoria de EXCLUSAO', async () => {
      prisma.lancamento.findFirst.mockResolvedValue(criarLancamentoPrisma());
      prisma.lancamento.update.mockResolvedValue({});

      await service.remover('lancamento-1', ctx);

      expect(prisma.lancamento.update).toHaveBeenCalledWith({
        where: { id: 'lancamento-1' },
        data: { deletadoEm: expect.any(Date) },
      });
      expect(audit.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: 'EXCLUSAO', entidadeId: 'lancamento-1' }),
      );
    });
  });

  describe('evolucaoMensal', () => {
    it('retorna exatamente 12 pontos mesmo quando o banco não tem dados', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const pontos = await service.evolucaoMensal({});

      expect(pontos).toHaveLength(12);
      for (const p of pontos) {
        expect(p.faturamento).toBe('0.00');
        expect(p.quantidade).toBe(0);
        expect(p.rotulo).toMatch(/^[A-Za-z]{3}\/\d{2}$/);
      }
    });

    it('preenche corretamente os meses com dados retornados pelo banco', async () => {
      const hoje = new Date();
      const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      prisma.$queryRaw.mockResolvedValue([
        { mes: mesAtual, faturamento: '1500.50', quantidade: BigInt(10) },
      ]);

      const pontos = await service.evolucaoMensal({});

      const pontoAtual = pontos.find((p) => p.mes === mesAtual);
      expect(pontoAtual?.faturamento).toBe('1500.50');
      expect(pontoAtual?.quantidade).toBe(10);
    });

    it('meses sem dados no banco são preenchidos com zeros (série contínua)', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const pontos = await service.evolucaoMensal({ tecnicoId: 'tecnico-1' });

      expect(pontos.every((p) => p.faturamento === '0.00')).toBe(true);
      expect(pontos.every((p) => p.quantidade === 0)).toBe(true);
    });
  });
});
