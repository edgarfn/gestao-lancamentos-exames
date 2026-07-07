import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAccessStrategy } from './jwt-access.strategy';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('JwtAccessStrategy', () => {
  let prisma: { usuario: { findUnique: jest.Mock }; tecnico: { findUnique: jest.Mock } };
  let strategy: JwtAccessStrategy;

  beforeEach(() => {
    prisma = {
      usuario: { findUnique: jest.fn() },
      tecnico: { findUnique: jest.fn() },
    };
    const config = {
      getOrThrow: jest.fn().mockReturnValue('segredo-de-teste-acesso'),
    } as unknown as ConfigService;
    strategy = new JwtAccessStrategy(config, prisma as unknown as PrismaService);
  });

  it('rejeita payloads que não sejam de tipo "access" (ex.: token de refresh reaproveitado)', async () => {
    await expect(strategy.validate({ sub: 'user-1', type: 'refresh' } as never)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
  });

  it('rejeita quando o usuário não existe mais', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 'user-1', type: 'access' } as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejeita usuários desativados, mesmo com token ainda válido (revogação imediata)', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      papel: 'ADMIN',
      ativo: false,
    });

    await expect(strategy.validate({ sub: 'user-1', type: 'access' } as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('retorna apenas id, email e papel — nunca dados sensíveis ou hash de senha', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      papel: 'GESTOR',
      ativo: true,
      senhaHash: 'hash-secreto',
    });

    const resultado = await strategy.validate({ sub: 'user-1', type: 'access' } as never);

    expect(resultado).toMatchObject({ id: 'user-1', email: 'a@b.com', papel: 'GESTOR', tecnicoId: null });
    expect(resultado).not.toHaveProperty('senhaHash');
    expect(prisma.tecnico.findUnique).not.toHaveBeenCalled();
  });

  it('popula tecnicoId para usuários com papel TECNICO', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'user-tec',
      email: 'tec@b.com',
      papel: 'TECNICO',
      ativo: true,
    });
    prisma.tecnico.findUnique.mockResolvedValue({ id: 'tecnico-42' });

    const resultado = await strategy.validate({ sub: 'user-tec', type: 'access' } as never);

    expect(prisma.tecnico.findUnique).toHaveBeenCalledWith({
      where: { usuarioId: 'user-tec' },
      select: { id: true },
    });
    expect(resultado.tecnicoId).toBe('tecnico-42');
  });

  it('retorna tecnicoId null quando TECNICO não tem registro Tecnico vinculado', async () => {
    prisma.usuario.findUnique.mockResolvedValue({
      id: 'user-tec',
      email: 'tec@b.com',
      papel: 'TECNICO',
      ativo: true,
    });
    prisma.tecnico.findUnique.mockResolvedValue(null);

    const resultado = await strategy.validate({ sub: 'user-tec', type: 'access' } as never);

    expect(resultado.tecnicoId).toBeNull();
  });
});
