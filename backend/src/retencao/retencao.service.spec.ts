import { RetencaoService } from './retencao.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { AuditService } from '../common/audit/audit.service';
import { ConfigService } from '@nestjs/config';

describe('RetencaoService', () => {
  let prisma: { paciente: { findMany: jest.Mock; update: jest.Mock } };
  let crypto: { encrypt: jest.Mock };
  let audit: { registrar: jest.Mock };
  let config: { get: jest.Mock };
  let service: RetencaoService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-07T03:00:00.000Z'));
    prisma = { paciente: { findMany: jest.fn(), update: jest.fn() } };
    crypto = { encrypt: jest.fn().mockReturnValue('cifrado:00000000000') };
    audit = { registrar: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn() };
    service = new RetencaoService(
      prisma as unknown as PrismaService,
      crypto as unknown as CryptoService,
      audit as unknown as AuditService,
      config as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('usa o limite de retenção configurado (DATA_RETENTION_DAYS) para selecionar candidatos elegíveis', async () => {
    config.get.mockReturnValue(365);
    prisma.paciente.findMany.mockResolvedValue([]);

    await service.executarAnonimizacaoProgramada();

    const limiteEsperado = new Date('2026-06-07T03:00:00.000Z');
    limiteEsperado.setDate(limiteEsperado.getDate() - 365);

    expect(prisma.paciente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletadoEm: null,
          anonimizadoEm: null,
          lancamentos: { some: {}, every: { data: { lt: limiteEsperado } } },
        }),
      }),
    );
  });

  it('aplica um valor padrão de retenção quando DATA_RETENTION_DAYS não está configurado', async () => {
    config.get.mockReturnValue(undefined);
    prisma.paciente.findMany.mockResolvedValue([]);

    await service.executarAnonimizacaoProgramada();

    const limiteEsperado = new Date('2026-06-07T03:00:00.000Z');
    limiteEsperado.setDate(limiteEsperado.getDate() - 1825);

    expect(prisma.paciente.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lancamentos: { some: {}, every: { data: { lt: limiteEsperado } } },
        }),
      }),
    );
  });

  it('não realiza nenhuma alteração quando não há pacientes elegíveis', async () => {
    config.get.mockReturnValue(365);
    prisma.paciente.findMany.mockResolvedValue([]);

    await service.executarAnonimizacaoProgramada();

    expect(prisma.paciente.update).not.toHaveBeenCalled();
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('anonimiza cada paciente elegível de forma irreversível e registra auditoria do processo automatizado', async () => {
    config.get.mockReturnValue(365);
    prisma.paciente.findMany.mockResolvedValue([
      { id: 'paciente-1', documentoCifrado: 'cifrado:documento-1' },
      { id: 'paciente-2', documentoCifrado: 'cifrado:documento-2' },
    ]);
    prisma.paciente.update.mockResolvedValue({});

    await service.executarAnonimizacaoProgramada();

    expect(prisma.paciente.update).toHaveBeenCalledTimes(2);
    expect(prisma.paciente.update).toHaveBeenCalledWith({
      where: { id: 'paciente-1' },
      data: {
        nome: '[ANONIMIZADO POR POLÍTICA DE RETENÇÃO]',
        documentoCifrado: 'cifrado:00000000000',
        documentoHash: expect.stringMatching(/^anon-retencao:[a-f0-9]{64}$/),
        contatoCifrado: null,
        anonimizadoEm: expect.any(Date),
      },
    });

    expect(audit.registrar).toHaveBeenCalledTimes(2);
    expect(audit.registrar).toHaveBeenCalledWith({
      usuarioId: null,
      acao: 'ANONIMIZACAO',
      entidade: 'Paciente',
      entidadeId: 'paciente-1',
      dadosNovos: { motivo: 'politica_de_retencao_automatica' },
    });
  });

  it('gera hashes de documento determinísticos e distintos por paciente (evita colisão e reidentificação)', async () => {
    config.get.mockReturnValue(365);
    prisma.paciente.findMany.mockResolvedValue([
      { id: 'paciente-1', documentoCifrado: 'cifrado:documento-1' },
      { id: 'paciente-2', documentoCifrado: 'cifrado:documento-2' },
    ]);
    prisma.paciente.update.mockResolvedValue({});

    await service.executarAnonimizacaoProgramada();

    const hash1 = prisma.paciente.update.mock.calls[0][0].data.documentoHash;
    const hash2 = prisma.paciente.update.mock.calls[1][0].data.documentoHash;
    expect(hash1).not.toEqual(hash2);
  });

  it('não regrava documento/hash para pacientes que nunca tiveram CPF cadastrado (minimização de dados)', async () => {
    config.get.mockReturnValue(365);
    prisma.paciente.findMany.mockResolvedValue([{ id: 'paciente-1', documentoCifrado: null }]);
    prisma.paciente.update.mockResolvedValue({});

    await service.executarAnonimizacaoProgramada();

    expect(prisma.paciente.update).toHaveBeenCalledWith({
      where: { id: 'paciente-1' },
      data: {
        nome: '[ANONIMIZADO POR POLÍTICA DE RETENÇÃO]',
        contatoCifrado: null,
        anonimizadoEm: expect.any(Date),
      },
    });
    expect(crypto.encrypt).not.toHaveBeenCalled();
  });
});
