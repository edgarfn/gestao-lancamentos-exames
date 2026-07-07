import { Request } from 'express';
import { ExamesController } from './exames.controller';
import { ExamesService } from './exames.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

function criarRequisicao(): Request {
  const usuario: AuthenticatedUser = { id: 'user-1', email: 'a@b.com', papel: 'ADMIN' };
  return { ip: '203.0.113.10', headers: { 'user-agent': 'jest-agent' }, user: usuario } as unknown as Request;
}

const contextoEsperado = { usuarioId: 'user-1', operadorPapel: 'ADMIN', enderecoIp: '203.0.113.10', enderecoIpProxy: null, userAgent: 'jest-agent' };

describe('ExamesController', () => {
  let service: Partial<Record<keyof ExamesService, jest.Mock>>;
  let controller: ExamesController;

  beforeEach(() => {
    service = {
      criar: jest.fn().mockResolvedValue({ id: 'exame-1' }),
      listar: jest.fn().mockResolvedValue({ itens: [], total: 0 }),
      buscarPorId: jest.fn().mockResolvedValue({ id: 'exame-1' }),
      atualizar: jest.fn().mockResolvedValue({ id: 'exame-1' }),
      remover: jest.fn().mockResolvedValue(undefined),
    };
    controller = new ExamesController(service as unknown as ExamesService);
  });

  it('criar repassa o DTO e o contexto de auditoria extraído da requisição', async () => {
    const dto = { nome: 'Hemograma', codigo: 'HEMO-001', valorPadrao: '150.00' } as never;

    await controller.criar(dto, criarRequisicao());

    expect(service.criar).toHaveBeenCalledWith(dto, contextoEsperado);
  });

  it('listar repassa os parâmetros de consulta ao serviço', async () => {
    const query = { busca: 'hemo' } as never;

    await controller.listar(query);

    expect(service.listar).toHaveBeenCalledWith(query);
  });

  it('buscar delega ao serviço pelo id', async () => {
    await controller.buscar('exame-1');

    expect(service.buscarPorId).toHaveBeenCalledWith('exame-1');
  });

  it('atualizar repassa id, DTO parcial e contexto de auditoria', async () => {
    const dto = { nome: 'Hemograma completo' } as never;

    await controller.atualizar('exame-1', dto, criarRequisicao());

    expect(service.atualizar).toHaveBeenCalledWith('exame-1', dto, contextoEsperado);
  });

  it('remover delega exclusão lógica ao serviço com o contexto de auditoria', async () => {
    await controller.remover('exame-1', criarRequisicao());

    expect(service.remover).toHaveBeenCalledWith('exame-1', contextoEsperado);
  });
});
