import { NotFoundException, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import { ConfiguracoesService } from './configuracoes.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';

jest.mock('fs/promises', () => ({
  ...jest.requireActual('fs/promises'),
  mkdir: jest.fn(),
  unlink: jest.fn(),
  writeFile: jest.fn(),
}));
jest.mock('fs', () => ({ ...jest.requireActual('fs'), createReadStream: jest.fn() }));

const mkdirMock = mkdir as jest.Mock;
const unlinkMock = unlink as jest.Mock;
const writeFileMock = writeFile as jest.Mock;
const createReadStreamMock = createReadStream as jest.Mock;

const DIRETORIO = '/var/uploads/configuracoes';
const ctx = { usuarioId: 'admin-1', operadorPapel: 'ADMIN' as const, enderecoIp: '127.0.0.1', enderecoIpProxy: null, userAgent: 'jest' };

function criarConfigPrisma(parcial: Record<string, unknown> = {}) {
  return {
    id: 'singleton',
    nomeClinica: 'Clínica Teste',
    cnpj: null,
    endereco: null,
    telefone: null,
    emailContato: null,
    logoNome: null,
    mensagemBemVindo: null,
    atualizadoEm: new Date('2026-06-01'),
    ...parcial,
  };
}

describe('ConfiguracoesService', () => {
  let prisma: { configuracao: { findUnique: jest.Mock; upsert: jest.Mock } };
  let audit: { registrar: jest.Mock };
  let config: { get: jest.Mock };
  let service: ConfiguracoesService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = { configuracao: { findUnique: jest.fn(), upsert: jest.fn() } };
    audit = { registrar: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn().mockReturnValue(DIRETORIO) };
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);

    service = new ConfiguracoesService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      audit as unknown as AuditService,
    );
  });

  describe('obter', () => {
    it('retorna configuração existente com temLogo=false quando não há logo', async () => {
      prisma.configuracao.findUnique.mockResolvedValue(criarConfigPrisma());

      const resultado = await service.obter();

      expect(resultado.nomeClinica).toBe('Clínica Teste');
      expect(resultado.temLogo).toBe(false);
    });

    it('retorna temLogo=true quando há nome de logo cadastrado', async () => {
      prisma.configuracao.findUnique.mockResolvedValue(criarConfigPrisma({ logoNome: 'logo.png' }));

      const resultado = await service.obter();

      expect(resultado.temLogo).toBe(true);
    });

    it('retorna valores nulos quando não há configuração cadastrada', async () => {
      prisma.configuracao.findUnique.mockResolvedValue(null);

      const resultado = await service.obter();

      expect(resultado.nomeClinica).toBeNull();
      expect(resultado.temLogo).toBe(false);
    });
  });

  describe('atualizar', () => {
    it('faz upsert com os campos do DTO e registra auditoria', async () => {
      prisma.configuracao.findUnique.mockResolvedValue(criarConfigPrisma());
      prisma.configuracao.upsert.mockResolvedValue(
        criarConfigPrisma({ nomeClinica: 'Nova Clínica', telefone: '(11) 99999-9999' }),
      );

      const resultado = await service.atualizar({ nomeClinica: 'Nova Clínica', telefone: '(11) 99999-9999' }, ctx);

      expect(prisma.configuracao.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'singleton' } }),
      );
      expect(audit.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: 'ATUALIZACAO', entidade: 'Configuracao' }),
      );
      expect(resultado.nomeClinica).toBe('Nova Clínica');
    });
  });

  describe('salvarLogo', () => {
    it('rejeita extensões não permitidas', async () => {
      await expect(
        service.salvarLogo(Buffer.from('...'), 'logo.gif', ctx),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
      expect(writeFileMock).not.toHaveBeenCalled();
    });

    it('salva o arquivo, atualiza o banco e registra auditoria', async () => {
      prisma.configuracao.findUnique.mockResolvedValue(criarConfigPrisma());
      prisma.configuracao.upsert.mockResolvedValue(criarConfigPrisma({ logoNome: 'logo.png' }));

      const resultado = await service.salvarLogo(Buffer.from('img'), 'minha-marca.png', ctx);

      expect(mkdirMock).toHaveBeenCalledWith(DIRETORIO, { recursive: true });
      expect(writeFileMock).toHaveBeenCalledWith(join(DIRETORIO, 'logo.png'), Buffer.from('img'));
      expect(audit.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ dadosNovos: { logoNome: 'logo.png' } }),
      );
      expect(resultado.temLogo).toBe(true);
    });

    it('remove logo anterior quando a extensão muda', async () => {
      prisma.configuracao.findUnique.mockResolvedValue(criarConfigPrisma({ logoNome: 'logo.svg' }));
      prisma.configuracao.upsert.mockResolvedValue(criarConfigPrisma({ logoNome: 'logo.png' }));

      await service.salvarLogo(Buffer.from('img'), 'novo.png', ctx);

      expect(unlinkMock).toHaveBeenCalledWith(join(DIRETORIO, 'logo.svg'));
    });
  });

  describe('obterLogo', () => {
    it('lança NotFoundException quando não há logo configurado', async () => {
      prisma.configuracao.findUnique.mockResolvedValue(null);

      await expect(service.obterLogo()).rejects.toBeInstanceOf(NotFoundException);
    });

    it('retorna stream e contentType correto para PNG', async () => {
      prisma.configuracao.findUnique.mockResolvedValue(criarConfigPrisma({ logoNome: 'logo.png' }));
      createReadStreamMock.mockReturnValue('stream-fake');

      const resultado = await service.obterLogo();

      expect(resultado.contentType).toBe('image/png');
      expect(createReadStreamMock).toHaveBeenCalledWith(join(DIRETORIO, 'logo.png'));
    });
  });
});
