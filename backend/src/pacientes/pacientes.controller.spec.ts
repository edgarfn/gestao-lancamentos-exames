import { Request } from 'express';
import { PacientesController } from './pacientes.controller';
import { PacientesService } from './pacientes.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

function criarRequisicao(): Request {
  const usuario: AuthenticatedUser = { id: 'user-1', email: 'a@b.com', papel: 'ADMIN' };
  return { ip: '203.0.113.10', headers: { 'user-agent': 'jest-agent' }, user: usuario } as unknown as Request;
}

const contextoEsperado = { usuarioId: 'user-1', operadorPapel: 'ADMIN', enderecoIp: '203.0.113.10', enderecoIpProxy: null, userAgent: 'jest-agent' };

describe('PacientesController', () => {
  let service: Partial<Record<keyof PacientesService, jest.Mock>>;
  let controller: PacientesController;

  beforeEach(() => {
    service = {
      criar: jest.fn().mockResolvedValue({ id: 'paciente-1' }),
      listar: jest.fn().mockResolvedValue({ itens: [], total: 0 }),
      buscarPorId: jest.fn().mockResolvedValue({ id: 'paciente-1' }),
      atualizar: jest.fn().mockResolvedValue({ id: 'paciente-1' }),
      remover: jest.fn().mockResolvedValue(undefined),
      anonimizar: jest.fn().mockResolvedValue(undefined),
    };
    controller = new PacientesController(service as unknown as PacientesService);
  });

  it('criar repassa o DTO e o contexto de auditoria extraído da requisição', async () => {
    const dto = {
      nome: 'Maria',
      documento: '52998224725',
      dataNascimento: '1990-01-01',
      contato: '11999999999',
    } as never;

    await controller.criar(dto, criarRequisicao());

    expect(service.criar).toHaveBeenCalledWith(dto, contextoEsperado);
  });

  it('listar repassa os parâmetros de consulta ao serviço', async () => {
    const query = { nome: 'Maria' } as never;

    await controller.listar(query);

    expect(service.listar).toHaveBeenCalledWith(query);
  });

  it('buscar repassa id e contexto de auditoria — toda leitura de paciente é auditada (privacy by design)', async () => {
    await controller.buscar('paciente-1', criarRequisicao());

    expect(service.buscarPorId).toHaveBeenCalledWith('paciente-1', contextoEsperado);
  });

  it('atualizar repassa id, DTO parcial e contexto de auditoria', async () => {
    const dto = { nome: 'Maria Atualizada' } as never;

    await controller.atualizar('paciente-1', dto, criarRequisicao());

    expect(service.atualizar).toHaveBeenCalledWith('paciente-1', dto, contextoEsperado);
  });

  it('remover delega exclusão lógica ao serviço com o contexto de auditoria', async () => {
    await controller.remover('paciente-1', criarRequisicao());

    expect(service.remover).toHaveBeenCalledWith('paciente-1', contextoEsperado);
  });

  it('anonimizar delega ao serviço o expurgo de dados de identificação (direito ao esquecimento — LGPD)', async () => {
    await controller.anonimizar('paciente-1', criarRequisicao());

    expect(service.anonimizar).toHaveBeenCalledWith('paciente-1', contextoEsperado);
  });
});
