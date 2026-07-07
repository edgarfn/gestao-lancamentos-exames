import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtRefreshPayload } from '../types/authenticated-user';

export interface RefreshTokenContext {
  userId: string;
  refreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtRefreshPayload): Promise<RefreshTokenContext> {
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Token inválido para esta operação.');
    }

    const usuario = await this.prisma.usuario.findUnique({ where: { id: payload.sub } });
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Usuário inválido ou inativo.');
    }

    // sessionVersion desatualizada => refresh token revogado (ex.: logout global, troca de senha)
    if (usuario.versaoSessao !== payload.sessionVersion) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }

    const refreshToken = (req.body as { refreshToken?: string })?.refreshToken ?? '';
    return { userId: usuario.id, refreshToken };
  }
}
