import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';
import { PrismaService } from '../../common/prisma/prisma.service';

function criarRequisicao(refreshToken: string): Request {
  return { body: { refreshToken } } as unknown as Request;
}

describe('JwtRefreshStrategy', () => {
  let prisma: { usuario: { findUnique: jest.Mock } };
  let strategy: JwtRefreshStrategy;

  beforeEach(() => {
    prisma = { usuario: { findUnique: jest.fn() } };
    const config = {
      getOrThrow: jest.fn().mockReturnValue('segredo-de-teste-refresh'),
    } as unknown as ConfigService;
    strategy = new JwtRefreshStrategy(config, prisma as unknown as PrismaService);
  });

  it('rejeita payloads que não sejam de tipo "refresh" (ex.: token de acesso reaproveitado)', async () => {
    await expect(
      strategy.validate(criarRequisicao('token-x'), {
        sub: 'user-1',
        type: 'access',
        sessionVersion: 1,
      } as never),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejeita quando o usuário não existe ou está inativo', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(
      strategy.validate(criarRequisicao('token-x'), {
        sub: 'user-1',
        type: 'refresh',
        sessionVersion: 1,
      } as never),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejeita quando a versão de sessão do token está desatualizada (sessão revogada)', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'user-1', ativo: true, versaoSessao: 2 });

    await expect(
      strategy.validate(criarRequisicao('token-x'), {
        sub: 'user-1',
        type: 'refresh',
        sessionVersion: 1,
      } as never),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('retorna o contexto de renovação com o id do usuário e o refresh token recebido', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'user-1', ativo: true, versaoSessao: 1 });

    const resultado = await strategy.validate(criarRequisicao('token-valido'), {
      sub: 'user-1',
      type: 'refresh',
      sessionVersion: 1,
    } as never);

    expect(resultado).toEqual({ userId: 'user-1', refreshToken: 'token-valido' });
  });
});
