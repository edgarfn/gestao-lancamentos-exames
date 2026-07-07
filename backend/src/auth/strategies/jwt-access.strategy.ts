import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Papel } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthenticatedUser, JwtAccessPayload } from '../types/authenticated-user';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtAccessPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token inválido para esta operação.');
    }

    // Revalida o estado do usuário a cada requisição: contas desativadas
    // perdem acesso imediatamente, mesmo com um token ainda válido.
    const usuario = await this.prisma.usuario.findUnique({ where: { id: payload.sub } });
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Usuário inválido ou inativo.');
    }

    let tecnicoId: string | null = null;
    if (usuario.papel === Papel.TECNICO) {
      const tecnico = await this.prisma.tecnico.findUnique({
        where: { usuarioId: usuario.id },
        select: { id: true },
      });
      tecnicoId = tecnico?.id ?? null;
    }

    return { id: usuario.id, email: usuario.email, papel: usuario.papel, tecnicoId };
  }
}
