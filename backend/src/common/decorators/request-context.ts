import { Request } from 'express';
import { Papel } from '@prisma/client';
import { AuthenticatedUser } from '../../auth/types/authenticated-user';

export interface AuditContext {
  usuarioId: string | null;
  /** Papel do operador que originou a requisição — usado para restrições de autorização no serviço. */
  operadorPapel?: Papel | null;
  /** IP real do cliente, resolvido via X-Forwarded-For (requer trust proxy habilitado no Express). */
  enderecoIp: string | null;
  /** IP direto da conexão TCP — normalmente o proxy reverso ou container Docker. */
  enderecoIpProxy: string | null;
  userAgent: string | null;
}

/**
 * Extrai dados de contexto da requisição relevantes para auditoria
 * (quem, de onde) sem acoplar os serviços de domínio ao objeto Request.
 *
 * Com `trust proxy = 1` habilitado no Express:
 *  - `enderecoIp`      = IP real do cliente (do cabeçalho X-Forwarded-For)
 *  - `enderecoIpProxy` = IP direto da conexão TCP (proxy/container)
 */
export function extractAuditContext(req: Request): AuditContext {
  const user = (req as Request & { user?: AuthenticatedUser }).user;
  const socket = req.socket as { remoteAddress?: string } | undefined;
  return {
    usuarioId: user?.id ?? null,
    operadorPapel: user?.papel ?? null,
    enderecoIp: req.ip ?? null,
    enderecoIpProxy: socket?.remoteAddress ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}
