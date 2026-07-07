import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';

/**
 * Captura TODAS as exceções não tratadas e registra logs estruturados (JSON)
 * com contexto completo: reqId, userId, method, path, statusCode e o objeto
 * de erro (com stack trace em nível error/fatal).
 *
 * Regras de nível de log:
 *  - 5xx / não-HTTP → error (falha do sistema — exige atenção imediata)
 *  - 429           → warn  (rate limit — indicativo de abuso, não bug)
 *  - 4xx (exceto 401/404) → warn (erros do cliente — útil para depuração)
 *  - 401 Unauthorized → não logado aqui (AuthService já registra audit log)
 *  - 404 Not Found    → não logado (alto volume de bots/crawlers — ruído)
 *
 * Sanitização: NUNCA loga o corpo da requisição (req.body). O contexto
 * registrado contém apenas identificadores técnicos (ids, método, path).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(excecao: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { id?: string }>();
    const res = ctx.getResponse<Response>();

    const ehHttp = excecao instanceof HttpException;
    const statusCode = ehHttp ? excecao.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const usuario = req?.user as AuthenticatedUser | undefined;

    const contexto = {
      reqId: (req as Request & { id?: string })?.id,
      method: req?.method,
      path: req?.url,
      statusCode,
      userId: usuario?.id ?? null,
    };

    if (!ehHttp) {
      this.logger.error(
        { err: excecao as Error, ...contexto },
        'Exceção não tratada — erro interno inesperado',
      );
    } else if (statusCode >= 500) {
      this.logger.error({ err: excecao, ...contexto }, excecao.message);
    } else if (statusCode === 429) {
      this.logger.warn({ ...contexto }, 'Rate limit excedido');
    } else if (statusCode >= 400 && statusCode !== 401 && statusCode !== 404) {
      const resposta = excecao.getResponse();
      const msgs =
        typeof resposta === 'string'
          ? resposta
          : Array.isArray((resposta as Record<string, unknown>).message)
            ? ((resposta as Record<string, unknown[]>).message as string[]).join('; ')
            : ((resposta as Record<string, unknown>).message as string | undefined) ??
              excecao.message;
      this.logger.warn({ ...contexto }, `Requisição rejeitada (${statusCode}): ${msgs}`);
    }

    const corpoResposta: Record<string, unknown> = ehHttp
      ? (excecao.getResponse() as Record<string, unknown>)
      : { statusCode, message: 'Erro interno do servidor.' };

    if (typeof corpoResposta === 'object' && !Array.isArray(corpoResposta)) {
      corpoResposta.statusCode ??= statusCode;
    }

    httpAdapter.reply(res, corpoResposta, statusCode);
  }
}
