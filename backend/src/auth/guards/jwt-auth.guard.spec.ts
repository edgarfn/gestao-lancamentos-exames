import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

function criarContexto(): ExecutionContext {
  return { getHandler: () => ({}), getClass: () => ({}) } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
  });

  it('libera o acesso sem exigir token quando a rota é marcada com @Public()', () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    expect(guard.canActivate(criarContexto())).toBe(true);
  });

  it('delega à validação JWT padrão (AuthGuard) quando a rota não é pública', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const superCanActivate = jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true);

    expect(guard.canActivate(criarContexto())).toBe(true);
    expect(superCanActivate).toHaveBeenCalled();

    superCanActivate.mockRestore();
  });
});
