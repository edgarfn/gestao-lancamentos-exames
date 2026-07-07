import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ExamesService } from './exames.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import type { QueryExameDto } from './dto/query-exame.dto';

function criarExamePrisma(parcial: Record<string, unknown> = {}) {
  return {
    id: 'exame-1',
    nome: 'Hemograma completo',
    codigo: 'HEMO-001',
    valorPadrao: new Prisma.Decimal('150.00'),
    ativo: true,
    criadoEm: new Date('2026-01-01T00:00:00.000Z'),
    atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
    deletadoEm: null,
    ...parcial,
  };
}

describe('ExamesService', () => {
  let prisma: {
    $transaction: jest.Mock;
    exame: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let audit: { registrar: jest.Mock };
  let service: ExamesService;

  const ctx = { usuarioId: 'user-1', enderecoIp: '127.0.0.1', enderecoIpProxy: null, userAgent: 'jest' };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      exame: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new ExamesService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  });

  describe('criar', () => {
    it('rejeita código de exame duplicado', async () => {
      prisma.exame.findUnique.mockResolvedValue(criarExamePrisma());

      await expect(
        service.criar({ nome: 'Outro', codigo: 'HEMO-001', valorPadrao: '10.00', especialidadeId: 'esp-1' }, ctx),
      ).rejects.toThrow(ConflictException);
      expect(prisma.exame.create).not.toHaveBeenCalled();
    });

    it('cria o exame e serializa o valor Decimal como string na auditoria (evita falha de JSON)', async () => {
      prisma.exame.findUnique.mockResolvedValue(null);
      prisma.exame.create.mockResolvedValue(criarExamePrisma());

      await service.criar({ nome: 'Hemograma completo', codigo: 'HEMO-001', valorPadrao: '150.00', especialidadeId: 'esp-1' }, ctx);

      const dadosNovos = audit.registrar.mock.calls[0][0].dadosNovos;
      expect(dadosNovos.valorPadrao).toBe('150');
      expect(typeof dadosNovos.valorPadrao).toBe('string');
    });
  });

  describe('listar', () => {
    it('busca por nome ou código e filtra por status ativo', async () => {
      prisma.$transaction.mockImplementation(async (operacoes: unknown[]) =>
        Promise.all(operacoes as Promise<unknown>[]),
      );
      prisma.exame.findMany.mockResolvedValue([]);
      prisma.exame.count.mockResolvedValue(0);

      await service.listar({
        busca: 'hemo',
        ativo: 'true',
        skip: 0,
        take: 20,
        pagina: 1,
        tamanhoPagina: 20,
      } as QueryExameDto);

      expect(prisma.exame.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletadoEm: null,
            OR: [
              { nome: { contains: 'hemo', mode: 'insensitive' } },
              { codigo: { contains: 'hemo', mode: 'insensitive' } },
            ],
            ativo: true,
          },
        }),
      );
    });
  });

  describe('atualizar', () => {
    it('lança NotFoundException quando o exame não existe', async () => {
      prisma.exame.findFirst.mockResolvedValue(null);

      await expect(service.atualizar('id-x', { nome: 'Novo' }, ctx)).rejects.toThrow(NotFoundException);
    });

    it('preserva o valor padrão quando não informado na atualização', async () => {
      prisma.exame.findFirst.mockResolvedValue(criarExamePrisma());
      prisma.exame.update.mockResolvedValue(criarExamePrisma({ nome: 'Hemograma — atualizado' }));

      await service.atualizar('exame-1', { nome: 'Hemograma — atualizado' }, ctx);

      expect(prisma.exame.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'exame-1' },
          data: expect.objectContaining({ nome: 'Hemograma — atualizado', valorPadrao: criarExamePrisma().valorPadrao, ativo: true }),
        }),
      );
    });
  });

  describe('remover', () => {
    it('aplica soft delete e desativa o exame do catálogo', async () => {
      prisma.exame.findFirst.mockResolvedValue(criarExamePrisma());
      prisma.exame.update.mockResolvedValue({});

      await service.remover('exame-1', ctx);

      expect(prisma.exame.update).toHaveBeenCalledWith({
        where: { id: 'exame-1' },
        data: { deletadoEm: expect.any(Date), ativo: false },
      });
      expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'EXCLUSAO' }));
    });
  });
});
