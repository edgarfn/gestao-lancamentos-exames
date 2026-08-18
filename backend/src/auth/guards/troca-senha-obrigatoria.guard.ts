import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IGNORAR_TROCA_SENHA_OBRIGATORIA_KEY } from '../decorators/ignorar-troca-senha-obrigatoria.decorator';
import { AuthenticatedUser } from '../types/authenticated-user';

/** Código estável no corpo da resposta — permite ao frontend distinguir este bloqueio de outros 403. */
export const CODIGO_SENHA_TROCA_OBRIGATORIA = 'SENHA_TROCA_OBRIGATORIA';

/**
 * Bloqueia o uso da API enquanto a conta tiver uma senha provisória
 * pendente de troca (ver campo Usuario.precisaTrocarSenha). Roda após o
 * JwtAuthGuard/RolesGuard, com req.user já populado a partir de uma
 * consulta fresca ao banco a cada requisição — por isso o bloqueio vale
 * imediatamente após a criação/redefinição de senha, mesmo com um access
 * token de curta duração ainda válido.
 *
 * Rotas públicas (sem req.user) não são afetadas. Apenas as rotas
 * marcadas com @IgnorarTrocaSenhaObrigatoria() permanecem acessíveis
 * (troca de senha e logout), garantindo que o usuário sempre tenha um
 * caminho para concluir a troca ou encerrar a sessão.
 */
@Injectable()
export class TrocaSenhaObrigatoriaGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isento = this.reflector.getAllAndOverride<boolean>(IGNORAR_TROCA_SENHA_OBRIGATORIA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isento) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      return true;
    }

    if (user.precisaTrocarSenha) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'É necessário definir uma nova senha antes de continuar.',
        code: CODIGO_SENHA_TROCA_OBRIGATORIA,
      });
    }

    return true;
  }
}
