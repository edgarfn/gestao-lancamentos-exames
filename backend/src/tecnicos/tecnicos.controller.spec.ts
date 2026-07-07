import { Request } from 'express';
import { TecnicosController } from './tecnicos.controller';
import { TecnicosService } from './tecnicos.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

function criarRequisicao(): Request {
  const usuario: AuthenticatedUser = { id: 'user-1', email: 'a@b.com', papel: 'ADMIN' };
  return { ip: '203.0.113.10', headers: { 'user-agent': 'jest-agent' }, user: usuario } as unknown as Request;
}

const contextoEsperado = { usuarioId: 'user-1', operadorPapel: 'ADMIN', enderecoIp: '203.0.113.10', enderecoIpProxy: null, userAgent: 'jest-agent' };

describe('TecnicosController', () => {
  let service: Partial<Record<keyof TecnicosService, jest.Mock>>;
  let controller: TecnicosController;

  beforeEach(() => {
    service = {
      criar: jest.fn().mockResolvedValue({ id: 'tecnico-1' }),
      listar: jest.fn().mockResolvedValue({ itens: [], total: 0 }),
      buscarPorId: jest.fn().mockResolvedValue({ id: 'tecnico-1' }),
      atualizar: jest.fn().mockResolvedValue({ id: 'tecnico-1' }),
      remover: jest.fn().mockResolvedValue(undefined),
    };
    controller = new TecnicosController(service as unknown as TecnicosService);
  });

  it('criar repassa o DTO e o contexto de auditoria extraído da requisição', async () => {
    const dto = { nome: 'Ana', documento: '52998224725', registroProfissional: 'CRBM-1' } as never;

    await controller.criar(dto, criarRequisicao());

    expect(service.criar).toHaveBeenCalledWith(dto, contextoEsperado);
  });

  it('listar repassa os parâmetros de consulta/paginação ao serviço', async () => {
    const query = { nome: 'Ana' } as never;

    await controller.listar(query);

    expect(service.listar).toHaveBeenCalledWith(query);
  });

  it('buscar delega ao serviço pelo id', async () => {
    await controller.buscar('tecnico-1');

    expect(service.buscarPorId).toHaveBeenCalledWith('tecnico-1');
  });

  it('atualizar repassa id, DTO parcial e contexto de auditoria', async () => {
    const dto = { nome: 'Ana Renomeada' } as never;

    await controller.atualizar('tecnico-1', dto, criarRequisicao());

    expect(service.atualizar).toHaveBeenCalledWith('tecnico-1', dto, contextoEsperado);
  });

  it('remover delega exclusão lógica ao serviço com o contexto de auditoria', async () => {
    await controller.remover('tecnico-1', criarRequisicao());

    expect(service.remover).toHaveBeenCalledWith('tecnico-1', contextoEsperado);
  });
});
