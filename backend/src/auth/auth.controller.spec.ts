import { Request } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './types/authenticated-user';

function criarRequisicao(parcial: Record<string, unknown> = {}): Request {
  return { ip: '203.0.113.10', headers: { 'user-agent': 'jest-agent' }, ...parcial } as unknown as Request;
}

describe('AuthController', () => {
  let service: Partial<Record<keyof AuthService, jest.Mock>>;
  let controller: AuthController;

  const usuario: AuthenticatedUser = { id: 'user-1', email: 'a@b.com', papel: 'ADMIN' };

  beforeEach(() => {
    service = {
      login: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
      renovarTokens: jest.fn().mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2' }),
      revogarSessoes: jest.fn().mockResolvedValue(undefined),
      alterarSenha: jest.fn().mockResolvedValue(undefined),
    };
    controller = new AuthController(service as unknown as AuthService);
  });

  it('login repassa credenciais e contexto de auditoria (IP/user-agent) ao serviço', async () => {
    const resultado = await controller.login(
      { email: 'a@b.com', senha: 'Senha123!', turnstileToken: 'token-turnstile' },
      criarRequisicao(),
    );

    expect(service.login).toHaveBeenCalledWith('a@b.com', 'Senha123!', 'token-turnstile', {
      enderecoIp: '203.0.113.10',
      enderecoIpProxy: null,
      userAgent: 'jest-agent',
    });
    expect(resultado).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });

  it('refresh extrai o userId do contexto de refresh validado pela estratégia jwt-refresh', async () => {
    const requisicao = criarRequisicao({ user: { userId: 'user-1', refreshToken: 'token-x' } });

    const resultado = await controller.refresh({ refreshToken: 'token-x' }, requisicao);

    expect(service.renovarTokens).toHaveBeenCalledWith('user-1');
    expect(resultado).toEqual({ accessToken: 'a2', refreshToken: 'r2' });
  });

  it('logoutAll revoga todas as sessões do usuário autenticado', async () => {
    await controller.logoutAll(usuario);

    expect(service.revogarSessoes).toHaveBeenCalledWith('user-1');
  });

  it('alterarSenha repassa senha atual e nova senha do usuário autenticado', async () => {
    await controller.alterarSenha(usuario, { senhaAtual: 'Antiga123!', novaSenha: 'Nova123!' });

    expect(service.alterarSenha).toHaveBeenCalledWith('user-1', 'Antiga123!', 'Nova123!');
  });
});
