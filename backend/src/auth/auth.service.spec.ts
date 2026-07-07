import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { TurnstileService } from './turnstile.service';
import { EmailService } from './email.service';

describe('AuthService', () => {
  let prisma: { usuario: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock } };
  let jwt: { signAsync: jest.Mock };
  let config: { getOrThrow: jest.Mock };
  let audit: { registrar: jest.Mock };
  let turnstile: { validar: jest.Mock };
  let email: { enviarRecuperacaoSenha: jest.Mock };
  let service: AuthService;

  const ctx = { enderecoIp: '127.0.0.1', enderecoIpProxy: null, userAgent: 'jest' };
  const TOKEN_TURNSTILE = 'token-turnstile-valido';

  beforeEach(() => {
    prisma = {
      usuario: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('token-assinado') };
    config = {
      getOrThrow: jest.fn((chave: string) => {
        const valores: Record<string, string> = {
          JWT_ACCESS_EXPIRES_IN: '15m',
          JWT_ACCESS_SECRET: 'segredo-de-acesso',
          JWT_REFRESH_SECRET: 'segredo-de-renovacao',
          JWT_REFRESH_EXPIRES_IN: '7d',
        };
        return valores[chave];
      }),
    };
    audit = { registrar: jest.fn().mockResolvedValue(undefined) };
    turnstile = { validar: jest.fn().mockResolvedValue(true) };
    email = { enviarRecuperacaoSenha: jest.fn().mockResolvedValue(undefined) };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
      audit as unknown as AuditService,
      turnstile as unknown as TurnstileService,
      email as unknown as EmailService,
    );
  });

  describe('login', () => {
    it('rejeita com mensagem própria quando a verificação Turnstile (anti-bot) falha, sem consultar o usuário', async () => {
      turnstile.validar.mockResolvedValue(false);

      await expect(
        service.login('alguem@clinica.com', 'qualquer-senha', 'token-invalido', ctx),
      ).rejects.toThrow('Verificação de segurança falhou. Atualize a página e tente novamente.');
      expect(turnstile.validar).toHaveBeenCalledWith('token-invalido', ctx.enderecoIp);
      expect(prisma.usuario.findUnique).not.toHaveBeenCalled();
      expect(audit.registrar).not.toHaveBeenCalled();
    });

    it('rejeita com mensagem genérica quando o usuário não existe (evita user enumeration)', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      await expect(
        service.login('inexistente@clinica.com', 'qualquer-senha', TOKEN_TURNSTILE, ctx),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.login('inexistente@clinica.com', 'qualquer-senha', TOKEN_TURNSTILE, ctx),
      ).rejects.toThrow('E-mail ou senha inválidos.');
      expect(audit.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: 'LOGIN_FALHO', usuarioId: null }),
      );
    });

    it('rejeita quando a senha está incorreta, sem revelar qual campo falhou', async () => {
      const senhaHash = await argon2.hash('senha-correta', { type: argon2.argon2id });
      prisma.usuario.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'tecnico@clinica.com',
        senhaHash,
        ativo: true,
        papel: 'TECNICO',
        nome: 'Técnico Um',
        versaoSessao: 1,
      });

      await expect(
        service.login('tecnico@clinica.com', 'senha-errada', TOKEN_TURNSTILE, ctx),
      ).rejects.toThrow('E-mail ou senha inválidos.');
      expect(audit.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: 'LOGIN_FALHO', usuarioId: 'user-1' }),
      );
    });

    it('rejeita usuários inativos mesmo com senha correta', async () => {
      const senhaHash = await argon2.hash('senha-correta', { type: argon2.argon2id });
      prisma.usuario.findUnique.mockResolvedValue({
        id: 'user-2',
        email: 'inativo@clinica.com',
        senhaHash,
        ativo: false,
        papel: 'TECNICO',
        nome: 'Inativo',
        versaoSessao: 1,
      });

      await expect(
        service.login('inativo@clinica.com', 'senha-correta', TOKEN_TURNSTILE, ctx),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('autentica com sucesso, registra auditoria de LOGIN e emite par de tokens', async () => {
      const senhaHash = await argon2.hash('senha-correta', { type: argon2.argon2id });
      prisma.usuario.findUnique.mockResolvedValue({
        id: 'user-3',
        email: 'gestor@clinica.com',
        senhaHash,
        ativo: true,
        papel: 'GESTOR',
        nome: 'Gestora Um',
        versaoSessao: 2,
      });
      prisma.usuario.update.mockResolvedValue({});

      const resultado = await service.login('gestor@clinica.com', 'senha-correta', TOKEN_TURNSTILE, ctx);

      expect(resultado.accessToken).toBe('token-assinado');
      expect(resultado.refreshToken).toBe('token-assinado');
      expect(resultado.usuario).toEqual({
        id: 'user-3',
        nome: 'Gestora Um',
        email: 'gestor@clinica.com',
        papel: 'GESTOR',
      });
      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id: 'user-3' },
        data: { ultimoLoginEm: expect.any(Date) },
      });
      expect(audit.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: 'LOGIN', usuarioId: 'user-3' }),
      );

      const payloadRefresh = jwt.signAsync.mock.calls[1][0];
      expect(payloadRefresh).toMatchObject({ sub: 'user-3', type: 'refresh', sessionVersion: 2 });
    });
  });

  describe('renovarTokens', () => {
    it('rejeita quando o usuário não existe ou está inativo', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      await expect(service.renovarTokens('user-x')).rejects.toThrow('Usuário inválido ou inativo.');
    });

    it('emite novo par de tokens para usuário ativo', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        id: 'user-4',
        email: 'admin@clinica.com',
        ativo: true,
        papel: 'ADMIN',
        versaoSessao: 5,
      });

      const tokens = await service.renovarTokens('user-4');

      expect(tokens.accessToken).toBe('token-assinado');
      expect(tokens.refreshToken).toBe('token-assinado');
    });
  });

  describe('revogarSessoes', () => {
    it('incrementa a versão de sessão para invalidar refresh tokens existentes', async () => {
      prisma.usuario.update.mockResolvedValue({});

      await service.revogarSessoes('user-5');

      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id: 'user-5' },
        data: { versaoSessao: { increment: 1 } },
      });
    });
  });

  describe('alterarSenha', () => {
    it('rejeita quando a senha atual está incorreta', async () => {
      const senhaHash = await argon2.hash('senha-atual', { type: argon2.argon2id });
      prisma.usuario.findUniqueOrThrow.mockResolvedValue({ id: 'user-6', senhaHash });

      await expect(service.alterarSenha('user-6', 'senha-errada', 'nova-senha-Forte123!')).rejects.toThrow(
        'Senha atual incorreta.',
      );
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('atualiza o hash, incrementa a versão de sessão e audita a troca', async () => {
      const senhaHash = await argon2.hash('senha-atual', { type: argon2.argon2id });
      prisma.usuario.findUniqueOrThrow.mockResolvedValue({ id: 'user-7', senhaHash });
      prisma.usuario.update.mockResolvedValue({});

      await service.alterarSenha('user-7', 'senha-atual', 'nova-senha-Forte123!');

      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id: 'user-7' },
        data: { senhaHash: expect.any(String), versaoSessao: { increment: 1 } },
      });
      expect(audit.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ usuarioId: 'user-7', acao: 'ATUALIZACAO' }),
      );
    });
  });
});
