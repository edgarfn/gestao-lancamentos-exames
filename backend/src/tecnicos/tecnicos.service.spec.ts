import { ConflictException, NotFoundException } from '@nestjs/common';
import { TecnicosService } from './tecnicos.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { AuditService } from '../common/audit/audit.service';
import type { QueryTecnicoDto } from './dto/query-tecnico.dto';

function criarTecnicoPrisma(parcial: Record<string, unknown> = {}) {
  return {
    id: 'tecnico-1',
    nome: 'Ana Técnica',
    documentoCifrado: 'cifrado:documento' as string | null,
    documentoHash: 'hash-documento' as string | null,
    registroProfissional: 'CRBM-12345' as string | null,
    ativo: true,
    criadoEm: new Date('2026-01-01T00:00:00.000Z'),
    atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
    deletadoEm: null,
    ...parcial,
  };
}

describe('TecnicosService', () => {
  let prisma: {
    $transaction: jest.Mock;
    tecnico: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let crypto: { encrypt: jest.Mock; searchHash: jest.Mock };
  let audit: { registrar: jest.Mock };
  let service: TecnicosService;

  const ctx = { usuarioId: 'user-1', enderecoIp: '127.0.0.1', enderecoIpProxy: null, userAgent: 'jest' };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      tecnico: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    crypto = {
      encrypt: jest.fn((valor: string) => `cifrado:${valor}`),
      searchHash: jest.fn((valor: string) => `hash:${valor}`),
    };
    audit = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new TecnicosService(
      prisma as unknown as PrismaService,
      crypto as unknown as CryptoService,
      audit as unknown as AuditService,
    );
  });

  describe('criar', () => {
    it('rejeita CPF duplicado verificando apenas o hash determinístico', async () => {
      prisma.tecnico.findUnique.mockResolvedValue(criarTecnicoPrisma());

      await expect(
        service.criar({ nome: 'Outro', documento: '52998224725', registroProfissional: 'CRBM-1' }, ctx),
      ).rejects.toThrow(ConflictException);
      expect(prisma.tecnico.create).not.toHaveBeenCalled();
    });

    it('cifra o documento e nunca expõe o CPF na resposta nem na auditoria', async () => {
      prisma.tecnico.findUnique.mockResolvedValue(null);
      prisma.tecnico.create.mockResolvedValue(criarTecnicoPrisma());

      const resultado = await service.criar(
        { nome: 'Ana Técnica', documento: '52998224725', registroProfissional: 'CRBM-12345' },
        ctx,
      );

      expect(prisma.tecnico.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          documentoCifrado: 'cifrado:52998224725',
          documentoHash: 'hash:52998224725',
          ativo: true,
        }),
      });
      expect(resultado).not.toHaveProperty('documento');
      expect(JSON.stringify(audit.registrar.mock.calls[0][0].dadosNovos)).not.toContain('52998224725');
    });

    it('cria técnico sem CPF: não consulta duplicidade nem cifra, grava documentoCifrado/Hash null', async () => {
      prisma.tecnico.create.mockResolvedValue(
        criarTecnicoPrisma({ documentoCifrado: null, documentoHash: null }),
      );

      await service.criar({ nome: 'João Técnico', registroProfissional: 'CRBM-99' }, ctx);

      expect(crypto.searchHash).not.toHaveBeenCalled();
      expect(prisma.tecnico.findUnique).not.toHaveBeenCalled();
      expect(crypto.encrypt).not.toHaveBeenCalled();
      expect(prisma.tecnico.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ documentoCifrado: null, documentoHash: null }),
      });
    });

    it('cria técnico sem registro profissional: grava registroProfissional null', async () => {
      prisma.tecnico.findUnique.mockResolvedValue(null);
      prisma.tecnico.create.mockResolvedValue(
        criarTecnicoPrisma({ registroProfissional: null }),
      );

      await service.criar({ nome: 'Maria Técnica', documento: '52998224725' }, ctx);

      expect(prisma.tecnico.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ registroProfissional: null }),
      });
    });
  });

  describe('listar', () => {
    it('filtra por nome (case-insensitive) e por status ativo', async () => {
      prisma.$transaction.mockImplementation(async (operacoes: unknown[]) =>
        Promise.all(operacoes as Promise<unknown>[]),
      );
      prisma.tecnico.findMany.mockResolvedValue([]);
      prisma.tecnico.count.mockResolvedValue(0);

      await service.listar({
        nome: 'Ana',
        ativo: 'true',
        skip: 0,
        take: 20,
        pagina: 1,
        tamanhoPagina: 20,
      } as QueryTecnicoDto);

      expect(prisma.tecnico.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletadoEm: null, nome: { contains: 'Ana', mode: 'insensitive' }, ativo: true },
        }),
      );
    });
  });

  describe('atualizar', () => {
    it('lança NotFoundException quando o técnico não existe', async () => {
      prisma.tecnico.findFirst.mockResolvedValue(null);

      await expect(service.atualizar('id-x', { nome: 'Novo Nome' }, ctx)).rejects.toThrow(NotFoundException);
    });

    it('preserva campos não informados e audita o antes/depois', async () => {
      prisma.tecnico.findFirst.mockResolvedValue(criarTecnicoPrisma());
      prisma.tecnico.update.mockResolvedValue(criarTecnicoPrisma({ nome: 'Ana Atualizada' }));

      await service.atualizar('tecnico-1', { nome: 'Ana Atualizada' }, ctx);

      expect(prisma.tecnico.update).toHaveBeenCalledWith({
        where: { id: 'tecnico-1' },
        data: { nome: 'Ana Atualizada', registroProfissional: 'CRBM-12345', ativo: true },
      });
      expect(audit.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'ATUALIZACAO',
          dadosAntigos: expect.objectContaining({ nome: 'Ana Técnica' }),
          dadosNovos: expect.objectContaining({ nome: 'Ana Atualizada' }),
        }),
      );
    });
  });

  describe('remover', () => {
    it('aplica soft delete e desativa o técnico, preservando o histórico de lançamentos', async () => {
      prisma.tecnico.findFirst.mockResolvedValue(criarTecnicoPrisma());
      prisma.tecnico.update.mockResolvedValue({});

      await service.remover('tecnico-1', ctx);

      expect(prisma.tecnico.update).toHaveBeenCalledWith({
        where: { id: 'tecnico-1' },
        data: { deletadoEm: expect.any(Date), ativo: false },
      });
      expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'EXCLUSAO' }));
    });

    it('lança NotFoundException ao tentar remover técnico inexistente', async () => {
      prisma.tecnico.findFirst.mockResolvedValue(null);

      await expect(service.remover('id-x', ctx)).rejects.toThrow(NotFoundException);
    });
  });
});
