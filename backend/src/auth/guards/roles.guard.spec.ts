import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { AuthenticatedUser } from '../types/authenticated-user';

function criarContexto(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function criarUsuario(papel: AuthenticatedUser['papel']): AuthenticatedUser {
  return { id: 'user-1', email: 'usuario@clinica.com', papel };
}

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('permite acesso quando o endpoint não declara @Roles(...)', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(criarContexto(criarUsuario('TECNICO')))).toBe(true);
  });

  it('permite acesso quando a lista de papéis exigidos está vazia', () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    expect(guard.canActivate(criarContexto(criarUsuario('TECNICO')))).toBe(true);
  });

  it('permite acesso quando o papel do usuário está entre os exigidos', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN', 'GESTOR']);

    expect(guard.canActivate(criarContexto(criarUsuario('GESTOR')))).toBe(true);
  });

  it('nega acesso (ForbiddenException) quando o papel do usuário não está entre os exigidos', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(() => guard.canActivate(criarContexto(criarUsuario('TECNICO')))).toThrow(ForbiddenException);
  });

  it('nega acesso quando não há usuário autenticado na requisição', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);

    expect(() => guard.canActivate(criarContexto(undefined))).toThrow(ForbiddenException);
  });
});
