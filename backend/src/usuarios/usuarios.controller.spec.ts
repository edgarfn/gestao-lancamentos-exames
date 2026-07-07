import { Request } from 'express';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

function criarRequisicao(
  usuario: AuthenticatedUser = { id: 'admin-1', email: 'admin@b.com', papel: 'ADMIN' },
): Request {
  return { ip: '203.0.113.10', headers: { 'user-agent': 'jest-agent' }, user: usuario } as unknown as Request;
}

const contextoEsperado = { usuarioId: 'admin-1', operadorPapel: 'ADMIN', enderecoIp: '203.0.113.10', enderecoIpProxy: null, userAgent: 'jest-agent' };

describe('UsuariosController', () => {
  let service: Partial<Record<keyof UsuariosService, jest.Mock>>;
  let controller: UsuariosController;

  beforeEach(() => {
    service = {
      criar: jest.fn().mockResolvedValue({ id: 'user-2' }),
      listar: jest.fn().mockResolvedValue([]),
      buscarPorId: jest.fn().mockResolvedValue({ id: 'user-2' }),
      atualizar: jest.fn().mockResolvedValue({ id: 'user-2' }),
      redefinirSenha: jest.fn().mockResolvedValue({ senhaTemporaria: 'temp-pass' }),
    };
    controller = new UsuariosController(service as unknown as UsuariosService);
  });

  it('criar repassa o DTO e o contexto de auditoria extraído da requisição', async () => {
    const dto = { nome: 'Novo', email: 'novo@b.com', senha: 'Senha123!', papel: 'TECNICO' } as never;

    await controller.criar(dto, criarRequisicao());

    expect(service.criar).toHaveBeenCalledWith(dto, contextoEsperado);
  });

  it('listar repassa o contexto de auditoria ao serviço', async () => {
    await controller.listar(criarRequisicao());

    expect(service.listar).toHaveBeenCalledWith(contextoEsperado);
  });

  it('buscar delega ao serviço pelo id', async () => {
    await controller.buscar('user-2');

    expect(service.buscarPorId).toHaveBeenCalledWith('user-2');
  });

  it('atualizar repassa id, DTO parcial e contexto de auditoria', async () => {
    const dto = { ativo: false } as never;

    await controller.atualizar('user-2', dto, criarRequisicao());

    expect(service.atualizar).toHaveBeenCalledWith('user-2', dto, contextoEsperado);
  });

  it('redefinirSenha delega ao serviço com o contexto de auditoria, sem expor a senha gerada na resposta do controller', async () => {
    const resultado = await controller.redefinirSenha('user-2', criarRequisicao());

    expect(service.redefinirSenha).toHaveBeenCalledWith('user-2', contextoEsperado);
    expect(resultado).toEqual({ senhaTemporaria: 'temp-pass' });
  });

  it('buscarPerfilProprio busca o cadastro do próprio usuário autenticado, nunca de terceiros', async () => {
    const tecnico: AuthenticatedUser = { id: 'tecnico-9', email: 'tecnico@b.com', papel: 'TECNICO' };

    await controller.buscarPerfilProprio(tecnico);

    expect(service.buscarPorId).toHaveBeenCalledWith('tecnico-9');
  });

  it('atualizarPerfilProprio repassa apenas o id do próprio usuário, o DTO restrito e o contexto de auditoria', async () => {
    const tecnico: AuthenticatedUser = { id: 'tecnico-9', email: 'tecnico@b.com', papel: 'TECNICO' };
    const dto = { nome: 'Novo Nome' } as never;

    await controller.atualizarPerfilProprio(tecnico, dto, criarRequisicao(tecnico));

    expect(service.atualizar).toHaveBeenCalledWith('tecnico-9', dto, {
      usuarioId: 'tecnico-9',
      operadorPapel: 'TECNICO',
      enderecoIp: '203.0.113.10', enderecoIpProxy: null,
      userAgent: 'jest-agent',
    });
  });
});
