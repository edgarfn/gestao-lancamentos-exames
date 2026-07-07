import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuditContext } from '../common/decorators/request-context';
import { JwtAccessPayload, JwtRefreshPayload } from './types/authenticated-user';
import { TurnstileService } from './turnstile.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

/**
 * Mensagem de erro deliberadamente genérica para falhas de login: evita
 * "user enumeration" (diferenciar "usuário não existe" de "senha incorreta"
 * ajudaria um atacante a mapear contas válidas).
 */
const CREDENCIAIS_INVALIDAS = 'E-mail ou senha inválidos.';

/** Mensagem para falhas na verificação anti-bot — distinta da de credenciais, pois não diz respeito à conta informada. */
const VERIFICACAO_SEGURANCA_FALHOU = 'Verificação de segurança falhou. Atualize a página e tente novamente.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly turnstile: TurnstileService,
  ) {}

  async login(
    email: string,
    senha: string,
    turnstileToken: string,
    ctx: Omit<AuditContext, 'usuarioId'>,
  ): Promise<TokenPair & { usuario: { id: string; nome: string; email: string; papel: string; tecnicoId: string | null } }> {
    const turnstileValido = await this.turnstile.validar(turnstileToken, ctx.enderecoIp);
    if (!turnstileValido) {
      throw new UnauthorizedException(VERIFICACAO_SEGURANCA_FALHOU);
    }

    const usuario = await this.prisma.usuario.findUnique({ where: { email } });

    // Mesmo quando o usuário não existe, executamos um hash "dummy" para
    // manter o tempo de resposta constante e dificultar timing attacks que
    // revelariam se o e-mail está cadastrado.
    const hashParaComparar = usuario?.senhaHash ?? (await this.dummyHash());
    const senhaConfere = await argon2.verify(hashParaComparar, senha).catch(() => false);

    if (!usuario || !usuario.ativo || !senhaConfere) {
      await this.audit.registrar({
        usuarioId: usuario?.id ?? null,
        acao: 'LOGIN_FALHO',
        entidade: 'Usuario',
        entidadeId: usuario?.id ?? null,
        enderecoIp: ctx.enderecoIp,
        enderecoIpProxy: ctx.enderecoIpProxy,
        userAgent: ctx.userAgent,
      });
      throw new UnauthorizedException(CREDENCIAIS_INVALIDAS);
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLoginEm: new Date() },
    });

    await this.audit.registrar({
      usuarioId: usuario.id,
      acao: 'LOGIN',
      entidade: 'Usuario',
      entidadeId: usuario.id,
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });

    let tecnicoId: string | null = null;
    if (usuario.papel === 'TECNICO') {
      const tec = await this.prisma.tecnico.findUnique({
        where: { usuarioId: usuario.id },
        select: { id: true },
      });
      tecnicoId = tec?.id ?? null;
    }

    const tokens = await this.emitirTokens(usuario.id, usuario.email, usuario.papel, usuario.versaoSessao);
    return {
      ...tokens,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel, tecnicoId },
    };
  }

  async renovarTokens(usuarioId: string): Promise<TokenPair> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Usuário inválido ou inativo.');
    }
    return this.emitirTokens(usuario.id, usuario.email, usuario.papel, usuario.versaoSessao);
  }

  /** Invalida todos os refresh tokens emitidos anteriormente (logout global / troca de senha). */
  async revogarSessoes(usuarioId: string): Promise<void> {
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { versaoSessao: { increment: 1 } },
    });
  }

  async alterarSenha(usuarioId: string, senhaAtual: string, novaSenha: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    const senhaAtualConfere = await argon2.verify(usuario.senhaHash, senhaAtual).catch(() => false);
    if (!senhaAtualConfere) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    const novoHash = await argon2.hash(novaSenha, { type: argon2.argon2id });
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { senhaHash: novoHash, versaoSessao: { increment: 1 } },
    });

    await this.audit.registrar({
      usuarioId,
      acao: 'ATUALIZACAO',
      entidade: 'Usuario',
      entidadeId: usuarioId,
      dadosNovos: { evento: 'troca_de_senha' },
    });
  }

  private async emitirTokens(
    usuarioId: string,
    email: string,
    papel: 'ADMIN' | 'GESTOR' | 'TECNICO',
    versaoSessao: number,
  ): Promise<TokenPair> {
    const accessPayload: JwtAccessPayload = { sub: usuarioId, email, papel, type: 'access' };
    const refreshPayload: JwtRefreshPayload = {
      sub: usuarioId,
      type: 'refresh',
      sessionVersion: versaoSessao,
    };

    const accessExpiresIn = this.config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN');
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessExpiresIn,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
      }),
    ]);

    return { accessToken, refreshToken, expiresIn: accessExpiresIn };
  }

  private async dummyHash(): Promise<string> {
    return argon2.hash('senha-ficticia-para-equalizar-tempo-de-resposta', { type: argon2.argon2id });
  }
}
