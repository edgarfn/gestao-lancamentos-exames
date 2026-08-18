import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CODIGO_SENHA_TROCA_OBRIGATORIA, TrocaSenhaObrigatoriaGuard } from './troca-senha-obrigatoria.guard';
import type { AuthenticatedUser } from '../types/authenticated-user';

function criarContexto(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function criarUsuario(precisaTrocarSenha: boolean): AuthenticatedUser {
  return { id: 'user-1', email: 'usuario@clinica.com', papel: 'TECNICO', precisaTrocarSenha };
}

describe('TrocaSenhaObrigatoriaGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: TrocaSenhaObrigatoriaGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new TrocaSenhaObrigatoriaGuard(reflector as unknown as Reflector);
  });

  it('permite acesso quando não há usuário autenticado (rota pública)', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(criarContexto(undefined))).toBe(true);
  });

  it('permite acesso quando o usuário não tem troca de senha pendente', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(criarContexto(criarUsuario(false)))).toBe(true);
  });

  it('bloqueia com ForbiddenException (código SENHA_TROCA_OBRIGATORIA) quando há troca pendente', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    try {
      guard.canActivate(criarContexto(criarUsuario(true)));
      fail('deveria ter lançado ForbiddenException');
    } catch (erro) {
      expect(erro).toBeInstanceOf(ForbiddenException);
      expect((erro as ForbiddenException).getResponse()).toMatchObject({
        code: CODIGO_SENHA_TROCA_OBRIGATORIA,
      });
    }
  });

  it('permite acesso a rotas marcadas com @IgnorarTrocaSenhaObrigatoria() mesmo com troca pendente', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    expect(guard.canActivate(criarContexto(criarUsuario(true)))).toBe(true);
  });
});
