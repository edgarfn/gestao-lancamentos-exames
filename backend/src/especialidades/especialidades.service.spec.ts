import { NotFoundException } from '@nestjs/common';
import { EspecialidadesService } from './especialidades.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';

function criarEspecialidadePrisma(parcial: Record<string, unknown> = {}) {
  return {
    id: 'esp-1',
    nome: 'Hematologia',
    descricao: null,
    ativo: true,
    criadoEm: new Date('2026-01-01T00:00:00.000Z'),
    atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
    deletadoEm: null,
    ...parcial,
  };
}

describe('EspecialidadesService', () => {
  let prisma: {
    $transaction: jest.Mock;
    especialidade: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let audit: { registrar: jest.Mock };
  let service: EspecialidadesService;

  const ctx = { usuarioId: 'user-1', enderecoIp: '127.0.0.1', enderecoIpProxy: null, userAgent: 'jest', operadorPapel: 'ADMIN' as const };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      especialidade: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    audit = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new EspecialidadesService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  });

  describe('criar', () => {
    it('cria especialidade e registra auditoria', async () => {
      const nova = criarEspecialidadePrisma();
      prisma.especialidade.create.mockResolvedValue(nova);

      const resultado = await service.criar({ nome: 'Hematologia' }, ctx);

      expect(prisma.especialidade.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ nome: 'Hematologia' }) }),
      );
      expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'CRIACAO', entidade: 'Especialidade' }));
      expect(resultado.id).toBe('esp-1');
    });
  });

  describe('listar', () => {
    it('retorna página de especialidades', async () => {
      prisma.$transaction.mockResolvedValue([[criarEspecialidadePrisma()], 1]);

      const resultado = await service.listar({ pagina: 1, tamanhoPagina: 20, skip: 0, take: 20 } as never);

      expect(resultado.itens).toHaveLength(1);
      expect(resultado.total).toBe(1);
    });
  });

  describe('buscarPorId', () => {
    it('lança NotFoundException quando não encontrado', async () => {
      prisma.especialidade.findFirst.mockResolvedValue(null);
      await expect(service.buscarPorId('inexistente')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('retorna especialidade existente', async () => {
      prisma.especialidade.findFirst.mockResolvedValue(criarEspecialidadePrisma());
      const resultado = await service.buscarPorId('esp-1');
      expect(resultado.nome).toBe('Hematologia');
    });
  });

  describe('atualizar', () => {
    it('atualiza nome e registra auditoria', async () => {
      const atual = criarEspecialidadePrisma();
      const atualizado = criarEspecialidadePrisma({ nome: 'Bioquímica' });
      prisma.especialidade.findFirst.mockResolvedValue(atual);
      prisma.especialidade.update.mockResolvedValue(atualizado);

      const resultado = await service.atualizar('esp-1', { nome: 'Bioquímica' }, ctx);

      expect(resultado.nome).toBe('Bioquímica');
      expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'ATUALIZACAO' }));
    });

    it('lança NotFoundException quando não encontrado', async () => {
      prisma.especialidade.findFirst.mockResolvedValue(null);
      await expect(service.atualizar('esp-x', {}, ctx)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remover', () => {
    it('aplica soft delete e registra auditoria', async () => {
      prisma.especialidade.findFirst.mockResolvedValue(criarEspecialidadePrisma());
      prisma.especialidade.update.mockResolvedValue({});

      await service.remover('esp-1', ctx);

      expect(prisma.especialidade.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ ativo: false }) }),
      );
      expect(audit.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'EXCLUSAO' }));
    });

    it('lança NotFoundException quando não encontrado', async () => {
      prisma.especialidade.findFirst.mockResolvedValue(null);
      await expect(service.remover('esp-x', ctx)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listarParaSelecao', () => {
    it('retorna lista compacta de especialidades ativas', async () => {
      const selecao = [{ id: 'esp-1', nome: 'Hematologia' }];
      prisma.especialidade.findMany.mockResolvedValue(selecao);

      const resultado = await service.listarParaSelecao();

      expect(prisma.especialidade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ ativo: true }) }),
      );
      expect(resultado).toEqual(selecao);
    });
  });
});
