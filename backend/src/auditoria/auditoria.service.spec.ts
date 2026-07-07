import { AuditoriaService } from './auditoria.service';
import { PrismaService } from '../common/prisma/prisma.service';
import type { QueryAuditoriaDto } from './dto/query-auditoria.dto';

function criarQuery(parcial: Partial<QueryAuditoriaDto> = {}): QueryAuditoriaDto {
  return { pagina: 1, tamanhoPagina: 20, skip: 0, take: 20, ...parcial } as QueryAuditoriaDto;
}

function criarRegistroPrisma(parcial: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    usuarioId: 'user-1',
    acao: 'ATUALIZACAO',
    entidade: 'Tecnico',
    entidadeId: 'tecnico-1',
    dadosAntigos: { nome: 'Antigo' },
    dadosNovos: { nome: 'Novo' },
    enderecoIp: '127.0.0.1',
    enderecoIpProxy: null,
    userAgent: 'jest',
    criadoEm: new Date('2026-06-01T10:00:00.000Z'),
    usuario: { id: 'user-1', nome: 'Ana Admin', email: 'ana@b.com' },
    ...parcial,
  };
}

describe('AuditoriaService', () => {
  let prisma: {
    $transaction: jest.Mock;
    auditLog: { findMany: jest.Mock; count: jest.Mock };
  };
  let service: AuditoriaService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      auditLog: { findMany: jest.fn(), count: jest.fn() },
    };
    service = new AuditoriaService(prisma as unknown as PrismaService);
  });

  describe('listar — construção dos filtros (operador, operação, cadastro afetado e período)', () => {
    it('não aplica nenhum filtro quando nenhum critério é informado', async () => {
      prisma.$transaction.mockImplementation(async (operacoes: unknown[]) =>
        Promise.all(operacoes as Promise<unknown>[]),
      );
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.listar(criarQuery());

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });

    it('combina os filtros de operador, operação, cadastro afetado e intervalo de datas', async () => {
      prisma.$transaction.mockImplementation(async (operacoes: unknown[]) =>
        Promise.all(operacoes as Promise<unknown>[]),
      );
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.listar(
        criarQuery({
          usuarioId: 'user-1',
          acao: 'EXCLUSAO',
          entidade: 'Lancamento',
          dataInicio: '2026-06-01',
          dataFim: '2026-06-30',
        }),
      );

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            usuarioId: 'user-1',
            acao: 'EXCLUSAO',
            entidade: 'Lancamento',
            criadoEm: {
              gte: new Date('2026-06-01T00:00:00.000Z'),
              lte: new Date('2026-06-30T23:59:59.999Z'),
            },
          },
        }),
      );
    });

    it('ordena por data de criação decrescente (mais recentes primeiro) e pagina os resultados', async () => {
      prisma.$transaction.mockImplementation(async (operacoes: unknown[]) =>
        Promise.all(operacoes as Promise<unknown>[]),
      );
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.listar(criarQuery({ pagina: 2, tamanhoPagina: 10, skip: 10, take: 10 }));

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { criadoEm: 'desc' }, skip: 10, take: 10 }),
      );
    });

    it('apresenta o operador e os snapshots de dados de forma estruturada para revisão', async () => {
      prisma.$transaction.mockImplementation(async (operacoes: unknown[]) =>
        Promise.all(operacoes as Promise<unknown>[]),
      );
      prisma.auditLog.findMany.mockResolvedValue([criarRegistroPrisma()]);
      prisma.auditLog.count.mockResolvedValue(1);

      const resultado = await service.listar(criarQuery());

      expect(resultado.itens[0]).toEqual({
        id: 'log-1',
        acao: 'ATUALIZACAO',
        entidade: 'Tecnico',
        entidadeId: 'tecnico-1',
        operador: { id: 'user-1', nome: 'Ana Admin', email: 'ana@b.com' },
        dadosAntigos: { nome: 'Antigo' },
        dadosNovos: { nome: 'Novo' },
        enderecoIp: '127.0.0.1',
        enderecoIpProxy: null,
        userAgent: 'jest',
        criadoEm: new Date('2026-06-01T10:00:00.000Z'),
      });
    });

    it('apresenta operador nulo quando o evento não está vinculado a um usuário (ex.: falha de login)', async () => {
      prisma.$transaction.mockImplementation(async (operacoes: unknown[]) =>
        Promise.all(operacoes as Promise<unknown>[]),
      );
      prisma.auditLog.findMany.mockResolvedValue([criarRegistroPrisma({ usuarioId: null, usuario: null })]);
      prisma.auditLog.count.mockResolvedValue(1);

      const resultado = await service.listar(criarQuery());

      expect(resultado.itens[0].operador).toBeNull();
    });
  });

  describe('listarEntidades', () => {
    it('retorna os tipos de cadastro distintos registrados na trilha, ordenados', async () => {
      prisma.auditLog.findMany.mockResolvedValue([{ entidade: 'Lancamento' }, { entidade: 'Tecnico' }]);

      const resultado = await service.listarEntidades();

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        distinct: ['entidade'],
        select: { entidade: true },
        orderBy: { entidade: 'asc' },
      });
      expect(resultado).toEqual(['Lancamento', 'Tecnico']);
    });
  });
});
