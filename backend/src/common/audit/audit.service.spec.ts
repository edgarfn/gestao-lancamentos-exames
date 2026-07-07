import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let prisma: { auditLog: { create: jest.Mock } };
  let service: AuditService;

  beforeEach(() => {
    prisma = { auditLog: { create: jest.fn() } };
    service = new AuditService(prisma as unknown as PrismaService);
  });

  it('grava o evento com todos os campos informados, normalizando ausentes para null', async () => {
    prisma.auditLog.create.mockResolvedValue({});

    await service.registrar({
      usuarioId: 'user-1',
      acao: 'LEITURA',
      entidade: 'Paciente',
      entidadeId: 'paciente-1',
      enderecoIp: '127.0.0.1',
      enderecoIpProxy: null,
      userAgent: 'jest',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        usuarioId: 'user-1',
        acao: 'LEITURA',
        entidade: 'Paciente',
        entidadeId: 'paciente-1',
        dadosAntigos: undefined,
        dadosNovos: undefined,
        enderecoIp: '127.0.0.1',
        enderecoIpProxy: null,
        userAgent: 'jest',
      },
    });
  });

  it('preenche usuarioId, entidadeId, ip e userAgent com null quando ausentes (nunca undefined no registro)', async () => {
    prisma.auditLog.create.mockResolvedValue({});

    await service.registrar({ acao: 'LOGIN_FALHO', entidade: 'Usuario' });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuarioId: null,
        entidadeId: null,
        enderecoIp: null,
        enderecoIpProxy: null,
        userAgent: null,
      }),
    });
  });

  it('não propaga exceções quando a gravação falha — auditoria não pode bloquear a operação de negócio', async () => {
    prisma.auditLog.create.mockRejectedValue(new Error('conexão indisponível'));

    await expect(service.registrar({ acao: 'CRIACAO', entidade: 'Lancamento' })).resolves.toBeUndefined();
  });
});
