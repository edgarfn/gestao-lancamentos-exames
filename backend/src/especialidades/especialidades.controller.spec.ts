import { Request } from 'express';
import { EspecialidadesController } from './especialidades.controller';
import { EspecialidadesService } from './especialidades.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

function criarRequisicao(): Request {
  const usuario: AuthenticatedUser = { id: 'user-1', email: 'admin@b.com', papel: 'ADMIN' };
  return { ip: '127.0.0.1', headers: { 'user-agent': 'jest' }, user: usuario } as unknown as Request;
}

const contextoEsperado = {
  usuarioId: 'user-1',
  operadorPapel: 'ADMIN',
  enderecoIp: '127.0.0.1',
  enderecoIpProxy: null,
  userAgent: 'jest',
};

describe('EspecialidadesController', () => {
  let service: Partial<Record<keyof EspecialidadesService, jest.Mock>>;
  let controller: EspecialidadesController;

  beforeEach(() => {
    service = {
      criar: jest.fn().mockResolvedValue({ id: 'esp-1', nome: 'Hematologia' }),
      listar: jest.fn().mockResolvedValue({ itens: [], total: 0 }),
      listarParaSelecao: jest.fn().mockResolvedValue([]),
      buscarPorId: jest.fn().mockResolvedValue({ id: 'esp-1' }),
      atualizar: jest.fn().mockResolvedValue({ id: 'esp-1' }),
      remover: jest.fn().mockResolvedValue(undefined),
    };
    controller = new EspecialidadesController(service as unknown as EspecialidadesService);
  });

  it('criar repassa DTO e contexto de auditoria ao serviço', async () => {
    const dto = { nome: 'Hematologia' };
    await controller.criar(dto as never, criarRequisicao());
    expect(service.criar).toHaveBeenCalledWith(dto, contextoEsperado);
  });

  it('listar delega ao serviço com query', async () => {
    const query = { busca: 'hema' } as never;
    await controller.listar(query);
    expect(service.listar).toHaveBeenCalledWith(query);
  });

  it('listarParaSelecao delega ao serviço sem parâmetros', async () => {
    await controller.listarParaSelecao();
    expect(service.listarParaSelecao).toHaveBeenCalledWith();
  });

  it('buscar delega ao serviço pelo id', async () => {
    await controller.buscar('esp-1');
    expect(service.buscarPorId).toHaveBeenCalledWith('esp-1');
  });

  it('atualizar repassa id, DTO e contexto ao serviço', async () => {
    const dto = { nome: 'Bioquímica' };
    await controller.atualizar('esp-1', dto as never, criarRequisicao());
    expect(service.atualizar).toHaveBeenCalledWith('esp-1', dto, contextoEsperado);
  });

  it('remover repassa id e contexto ao serviço', async () => {
    await controller.remover('esp-1', criarRequisicao());
    expect(service.remover).toHaveBeenCalledWith('esp-1', contextoEsperado);
  });
});
