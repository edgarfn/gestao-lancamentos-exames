import { BadRequestException, StreamableFile } from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfiguracoesController } from './configuracoes.controller';
import { ConfiguracoesService } from './configuracoes.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

function criarRequisicao(): Request {
  const usuario: AuthenticatedUser = { id: 'admin-1', email: 'admin@b.com', papel: 'ADMIN' };
  return { ip: '203.0.113.10', headers: { 'user-agent': 'jest-agent' }, user: usuario } as unknown as Request;
}

const contextoEsperado = { usuarioId: 'admin-1', operadorPapel: 'ADMIN', enderecoIp: '203.0.113.10', enderecoIpProxy: null, userAgent: 'jest-agent' };

const configApresentavel = {
  nomeClinica: 'Clínica Teste', cnpj: null, endereco: null, telefone: null,
  emailContato: null, temLogo: false, mensagemBemVindo: null,
};

describe('ConfiguracoesController', () => {
  let service: Partial<Record<keyof ConfiguracoesService, jest.Mock>>;
  let controller: ConfiguracoesController;

  beforeEach(() => {
    service = {
      obter: jest.fn().mockResolvedValue(configApresentavel),
      atualizar: jest.fn().mockResolvedValue(configApresentavel),
      salvarLogo: jest.fn().mockResolvedValue({ ...configApresentavel, temLogo: true }),
      obterLogo: jest.fn().mockResolvedValue({ stream: new StreamableFile(Buffer.from('')), contentType: 'image/png' }),
    };
    controller = new ConfiguracoesController(service as unknown as ConfiguracoesService);
  });

  it('obter delega ao serviço sem parâmetros', async () => {
    await controller.obter();
    expect(service.obter).toHaveBeenCalledWith();
  });

  it('atualizar repassa o DTO e o contexto de auditoria', async () => {
    const dto = { nomeClinica: 'Nova Clínica' };

    await controller.atualizar(dto, criarRequisicao());

    expect(service.atualizar).toHaveBeenCalledWith(dto, contextoEsperado);
  });

  it('salvarLogo lança BadRequest quando nenhum arquivo é enviado', async () => {
    await expect(controller.salvarLogo(undefined, criarRequisicao())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(service.salvarLogo).not.toHaveBeenCalled();
  });

  it('salvarLogo repassa buffer, nome original e contexto ao serviço', async () => {
    const arquivo = { originalname: 'logo.png', buffer: Buffer.from('img'), size: 3 };

    await controller.salvarLogo(arquivo, criarRequisicao());

    expect(service.salvarLogo).toHaveBeenCalledWith(
      Buffer.from('img'),
      'logo.png',
      contextoEsperado,
    );
  });

  it('obterLogo define Content-Type e Cache-Control e retorna StreamableFile', async () => {
    const resposta = { set: jest.fn() } as unknown as Response;

    const resultado = await controller.obterLogo(resposta);

    expect(resposta.set).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(resposta.set).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600');
    expect(resultado).toBeInstanceOf(StreamableFile);
  });
});
