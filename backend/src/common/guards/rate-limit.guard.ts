import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import {
  ThrottlerException,
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerRequest,
} from '@nestjs/throttler';
import type { Request, Response } from 'express';

/**
 * Guard de rate limiting com:
 *  - Cabeçalhos HTTP padrão: Retry-After (RFC 6585) + X-RateLimit-*
 *  - Log estruturado (JSON) com IP, path, limite, hits e tempo de espera
 *  - Fail-open: erros de storage (Redis down) permitem a requisição mas
 *    geram log de alerta — disponibilidade priorizada sobre proteção
 *    em caso de falha da infraestrutura de cache
 *  - IP tracking via req.ip (resolvido pelo trust proxy 1 no main.ts,
 *    preserva o endereço real do cliente mesmo atrás de proxy/CDN)
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  private readonly rateLimitLogger = new Logger(RateLimitGuard.name);

  // Fail-open: erros no storage não derrubam a aplicação
  protected override async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    try {
      return await super.handleRequest(requestProps);
    } catch (error) {
      if (error instanceof ThrottlerException) throw error;
      this.rateLimitLogger.error(
        { err: error as Error, path: requestProps.context.switchToHttp().getRequest<Request>().url },
        'ALERTA: falha no storage de rate limiting — requisição permitida (fail-open). Verifique Redis.',
      );
      return true;
    }
  }

  protected override async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const req = context.switchToHttp().getRequest<Request & { id?: string }>();
    const res = context.switchToHttp().getResponse<Response>();

    // Tempo de espera: usa bloqueio explícito se houver, senão o fim da janela atual
    const waitMs = detail.isBlocked && detail.timeToBlockExpire > 0
      ? detail.timeToBlockExpire
      : detail.timeToExpire;
    const retryAfterSecs = Math.ceil(waitMs / 1000);
    const resetAt = Math.floor(Date.now() / 1000) + retryAfterSecs;

    // RFC 6585 + IETF RateLimit Headers Draft-07
    res.setHeader('Retry-After', retryAfterSecs);
    res.setHeader('X-RateLimit-Limit', detail.limit);
    res.setHeader('X-RateLimit-Remaining', 0);
    res.setHeader('X-RateLimit-Reset', resetAt);
    // Formato: "<limite>;w=<janela em segundos>" (draft-polli-ratelimit-headers)
    res.setHeader('X-RateLimit-Policy', `${detail.limit};w=${Math.ceil(detail.ttl / 1000)}`);

    this.rateLimitLogger.warn({
      reqId: req?.id,
      ip: req?.ip,
      method: req?.method,
      path: req?.url,
      key: detail.key,
      limit: detail.limit,
      totalHits: detail.totalHits,
      windowSecs: Math.ceil(detail.ttl / 1000),
      retryAfterSecs,
      isBlocked: detail.isBlocked,
    }, 'Rate limit excedido — requisição bloqueada');

    throw new ThrottlerException(
      `Muitas requisições. Tente novamente em ${retryAfterSecs} segundo${retryAfterSecs !== 1 ? 's' : ''}.`,
    );
  }

  // Rastreia por IP real (X-Forwarded-For já resolvido pelo trust proxy 1)
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const ip =
      (req as unknown as Request).ip ??
      (req.socket as { remoteAddress?: string } | undefined)?.remoteAddress ??
      'unknown';
    return Promise.resolve(ip);
  }
}
