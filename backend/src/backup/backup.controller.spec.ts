import { BadRequestException, StreamableFile } from '@nestjs/common';
import { Request, Response } from 'express';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

function criarRequisicao(): Request {
  const usuario: AuthenticatedUser = { id: 'user-1', email: 'admin@b.com', papel: 'ADMIN' };
  return { ip: '203.0.113.10', headers: { 'user-agent': 'jest-agent' }, user: usuario } as unknown as Request;
}

const contextoEsperado = { usuarioId: 'user-1', operadorPapel: 'ADMIN', enderecoIp: '203.0.113.10', enderecoIpProxy: null, userAgent: 'jest-agent' };

describe('BackupController', () => {
  let service: Partial<Record<keyof BackupService, jest.Mock>>;
  let controller: BackupController;

  beforeEach(() => {
    service = {
      listar: jest.fn().mockResolvedValue([]),
      criar: jest.fn().mockResolvedValue({
        nome: 'backup-2026-06-08T02-00-00.dump',
        tamanhoBytes: 1024,
        criadoEm: new Date(),
      }),
      baixar: jest.fn(),
      remover: jest.fn().mockResolvedValue(undefined),
      restaurar: jest.fn().mockResolvedValue(undefined),
    };
    controller = new BackupController(service as unknown as BackupService);
  });

  it('listar delega ao serviço sem parâmetros', async () => {
    await controller.listar();
    expect(service.listar).toHaveBeenCalledWith();
  });

  it('criar repassa o contexto de auditoria e o flag criptografar ao serviço', async () => {
    await controller.criar({}, criarRequisicao());
    expect(service.criar).toHaveBeenCalledWith(contextoEsperado, false);
  });

  it('baixar define o cabeçalho de download e retorna o arquivo como StreamableFile', async () => {
    const streamable = new StreamableFile(Buffer.from('conteudo'));
    (service.baixar as jest.Mock).mockResolvedValue(streamable);
    const resposta = { set: jest.fn() } as unknown as Response;

    const resultado = await controller.baixar('backup-2026-06-08T02-00-00.dump', resposta);

    expect(service.baixar).toHaveBeenCalledWith('backup-2026-06-08T02-00-00.dump');
    expect(resposta.set).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="backup-2026-06-08T02-00-00.dump"',
    );
    expect(resultado).toBe(streamable);
  });

  it('remover repassa o nome e o contexto de auditoria ao serviço', async () => {
    await controller.remover('backup-2026-06-08T02-00-00.dump', criarRequisicao());
    expect(service.remover).toHaveBeenCalledWith('backup-2026-06-08T02-00-00.dump', contextoEsperado);
  });

  it('restaurar rejeita a requisição quando nenhum arquivo é enviado', async () => {
    await expect(controller.restaurar(undefined, criarRequisicao())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(service.restaurar).not.toHaveBeenCalled();
  });

  it('restaurar repassa o caminho temporário, o nome original e o contexto de auditoria ao serviço', async () => {
    const arquivo = { originalname: 'meu-backup.dump', path: '/tmp/restauracao-123.dump', size: 2048 };

    await controller.restaurar(arquivo, criarRequisicao());

    expect(service.restaurar).toHaveBeenCalledWith(
      '/tmp/restauracao-123.dump',
      'meu-backup.dump',
      contextoEsperado,
    );
  });
});
