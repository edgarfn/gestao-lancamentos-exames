import { ConflictException, NotFoundException } from '@nestjs/common';
import { PacientesService } from './pacientes.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { AuditService } from '../common/audit/audit.service';
import type { QueryPacienteDto } from './dto/query-paciente.dto';

function criarPacientePrisma(parcial: Record<string, unknown> = {}) {
  return {
    id: 'paciente-1',
    nome: 'João da Silva',
    documentoCifrado: 'cifrado:documento',
    documentoHash: 'hash-documento',
    dataNascimento: new Date('1990-05-20T00:00:00.000Z'),
    contatoCifrado: 'cifrado:contato',
    anonimizadoEm: null,
    criadoEm: new Date('2026-01-01T00:00:00.000Z'),
    atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
    deletadoEm: null,
    ...parcial,
  };
}

describe('PacientesService', () => {
  let prisma: {
    $transaction: jest.Mock;
    paciente: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let crypto: { encrypt: jest.Mock; decrypt: jest.Mock; searchHash: jest.Mock };
  let audit: { registrar: jest.Mock };
  let service: PacientesService;

  const ctx = { usuarioId: 'user-1', enderecoIp: '127.0.0.1', enderecoIpProxy: null, userAgent: 'jest' };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      paciente: {
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
      decrypt: jest.fn((valor: string) => valor.replace(/^cifrado:/, '')),
      searchHash: jest.fn((valor: string) => `hash:${valor}`),
    };
    audit = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new PacientesService(
      prisma as unknown as PrismaService,
      crypto as unknown as CryptoService,
      audit as unknown as AuditService,
    );
  });

  describe('criar', () => {
    it('rejeita cadastro duplicado com base no hash determinístico do documento (sem decifrar a base)', async () => {
      prisma.paciente.findUnique.mockResolvedValue(criarPacientePrisma());

      await expect(
        service.criar({ nome: 'Outro Nome', documento: '52998224725', dataNascimento: '1990-05-20' }, ctx),
      ).rejects.toThrow(ConflictException);
      expect(crypto.searchHash).toHaveBeenCalledWith('52998224725');
      expect(prisma.paciente.findUnique).toHaveBeenCalledWith({
        where: { documentoHash: 'hash:52998224725' },
      });
      expect(prisma.paciente.create).not.toHaveBeenCalled();
    });

    it('cifra documento e contato antes de persistir, e nunca expõe o CPF na auditoria', async () => {
      prisma.paciente.findUnique.mockResolvedValue(null);
      prisma.paciente.create.mockResolvedValue(criarPacientePrisma());

      const resultado = await service.criar(
        {
          nome: 'João da Silva',
          documento: '52998224725',
          dataNascimento: '1990-05-20',
          contato: '11999999999',
        },
        ctx,
      );

      expect(prisma.paciente.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          documentoCifrado: 'cifrado:52998224725',
          documentoHash: 'hash:52998224725',
          contatoCifrado: 'cifrado:11999999999',
        }),
      });
      expect(resultado.contato).toBe('contato');
      expect(resultado).not.toHaveProperty('documento');

      const dadosAuditoria = audit.registrar.mock.calls[0][0].dadosNovos;
      expect(JSON.stringify(dadosAuditoria)).not.toContain('52998224725');
      expect(JSON.stringify(dadosAuditoria)).not.toContain('cifrado');
    });

    it('persiste contato nulo quando não informado', async () => {
      prisma.paciente.findUnique.mockResolvedValue(null);
      prisma.paciente.create.mockResolvedValue(criarPacientePrisma({ contatoCifrado: null }));

      await service.criar(
        { nome: 'Maria Sem Contato', documento: '52998224725', dataNascimento: '1990-05-20' },
        ctx,
      );

      expect(prisma.paciente.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ contatoCifrado: null }),
      });
    });

    it('permite cadastro sem CPF/data de nascimento (minimização de dados) e dispensa a checagem de duplicidade', async () => {
      prisma.paciente.create.mockResolvedValue(
        criarPacientePrisma({ documentoCifrado: null, documentoHash: null, dataNascimento: null }),
      );

      await service.criar({ nome: 'Paciente Sem Documento' }, ctx);

      expect(crypto.searchHash).not.toHaveBeenCalled();
      expect(prisma.paciente.findUnique).not.toHaveBeenCalled();
      expect(prisma.paciente.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          documentoCifrado: null,
          documentoHash: null,
          dataNascimento: null,
        }),
      });
    });
  });

  describe('listar', () => {
    it('busca por documento usando o hash determinístico, nunca o valor em texto claro', async () => {
      prisma.$transaction.mockImplementation(async (operacoes: unknown[]) =>
        Promise.all(operacoes as Promise<unknown>[]),
      );
      prisma.paciente.findMany.mockResolvedValue([]);
      prisma.paciente.count.mockResolvedValue(0);

      await service.listar({
        documento: '52998224725',
        skip: 0,
        take: 20,
        pagina: 1,
        tamanhoPagina: 20,
      } as QueryPacienteDto);

      expect(prisma.paciente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletadoEm: null, documentoHash: 'hash:52998224725' } }),
      );
    });

    it('nunca inclui o CPF (mesmo cifrado) na apresentação da listagem', async () => {
      prisma.$transaction.mockImplementation(async (operacoes: unknown[]) =>
        Promise.all(operacoes as Promise<unknown>[]),
      );
      prisma.paciente.findMany.mockResolvedValue([criarPacientePrisma()]);
      prisma.paciente.count.mockResolvedValue(1);

      const resultado = await service.listar({
        skip: 0,
        take: 20,
        pagina: 1,
        tamanhoPagina: 20,
      } as QueryPacienteDto);

      expect(JSON.stringify(resultado.itens[0])).not.toMatch(/documento/i);
    });
  });

  describe('buscarPorId', () => {
    it('lança NotFoundException quando o paciente não existe', async () => {
      prisma.paciente.findFirst.mockResolvedValue(null);

      await expect(service.buscarPorId('id-x', ctx)).rejects.toThrow(NotFoundException);
    });

    it('audita toda LEITURA individual de dado de paciente (accountability/LGPD)', async () => {
      prisma.paciente.findFirst.mockResolvedValue(criarPacientePrisma());

      await service.buscarPorId('paciente-1', ctx);

      expect(audit.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'LEITURA',
          entidade: 'Paciente',
          entidadeId: 'paciente-1',
          usuarioId: 'user-1',
        }),
      );
    });
  });

  describe('anonimizar (direito ao esquecimento — LGPD art. 18)', () => {
    it('substitui nome, documento e contato por marcadores irreversíveis e marca anonimizadoEm', async () => {
      prisma.paciente.findFirst.mockResolvedValue(criarPacientePrisma());
      prisma.paciente.update.mockResolvedValue({});

      await service.anonimizar('paciente-1', ctx);

      expect(prisma.paciente.update).toHaveBeenCalledWith({
        where: { id: 'paciente-1' },
        data: {
          nome: '[ANONIMIZADO]',
          documentoCifrado: 'cifrado:00000000000',
          documentoHash: 'anon:paciente-1',
          contatoCifrado: null,
          anonimizadoEm: expect.any(Date),
        },
      });
      expect(audit.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: 'ANONIMIZACAO', entidadeId: 'paciente-1' }),
      );
    });

    it('não regrava documento/hash quando o paciente nunca teve CPF cadastrado', async () => {
      prisma.paciente.findFirst.mockResolvedValue(
        criarPacientePrisma({ documentoCifrado: null, documentoHash: null }),
      );
      prisma.paciente.update.mockResolvedValue({});

      await service.anonimizar('paciente-1', ctx);

      expect(prisma.paciente.update).toHaveBeenCalledWith({
        where: { id: 'paciente-1' },
        data: {
          nome: '[ANONIMIZADO]',
          contatoCifrado: null,
          anonimizadoEm: expect.any(Date),
        },
      });
    });

    it('é idempotente: não reprocessa um paciente já anonimizado', async () => {
      prisma.paciente.findFirst.mockResolvedValue(
        criarPacientePrisma({ anonimizadoEm: new Date('2026-01-01') }),
      );

      await service.anonimizar('paciente-1', ctx);

      expect(prisma.paciente.update).not.toHaveBeenCalled();
      expect(audit.registrar).not.toHaveBeenCalled();
    });

    it('lança NotFoundException para paciente inexistente ou já removido', async () => {
      prisma.paciente.findFirst.mockResolvedValue(null);

      await expect(service.anonimizar('id-x', ctx)).rejects.toThrow(NotFoundException);
    });
  });

  describe('paraApresentacao (via criar) — minimização de dados sensíveis', () => {
    it('decifra o contato para apresentação, mas jamais expõe o documento/CPF', async () => {
      prisma.paciente.findUnique.mockResolvedValue(null);
      prisma.paciente.create.mockResolvedValue(criarPacientePrisma());

      const resultado = await service.criar(
        {
          nome: 'João da Silva',
          documento: '52998224725',
          dataNascimento: '1990-05-20',
          contato: '11999999999',
        },
        ctx,
      );

      expect(crypto.decrypt).toHaveBeenCalledWith('cifrado:contato');
      expect(resultado.contato).toBe('contato');
      expect(Object.keys(resultado)).not.toContain('documento');
      expect(Object.keys(resultado)).not.toContain('documentoCifrado');
    });
  });
});
