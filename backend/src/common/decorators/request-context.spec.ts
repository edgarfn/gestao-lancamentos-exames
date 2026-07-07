import { Request } from 'express';
import { extractAuditContext } from './request-context';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';

function criarRequisicao(parcial: Record<string, unknown> = {}): Request {
  return {
    ip: '203.0.113.10',
    headers: { 'user-agent': 'jest-agent' },
    ...parcial,
  } as unknown as Request;
}

describe('extractAuditContext', () => {
  it('extrai usuarioId, operadorPapel, IPs e user-agent quando o usuário está autenticado', () => {
    const usuario: AuthenticatedUser = { id: 'user-1', email: 'a@b.com', papel: 'ADMIN' };

    expect(extractAuditContext(criarRequisicao({ user: usuario }))).toEqual({
      usuarioId: 'user-1',
      operadorPapel: 'ADMIN',
      enderecoIp: '203.0.113.10',
      enderecoIpProxy: null,
      userAgent: 'jest-agent',
    });
  });

  it('retorna usuarioId e operadorPapel nulos quando não há usuário autenticado na requisição (rotas públicas)', () => {
    expect(extractAuditContext(criarRequisicao())).toEqual({
      usuarioId: null,
      operadorPapel: null,
      enderecoIp: '203.0.113.10',
      enderecoIpProxy: null,
      userAgent: 'jest-agent',
    });
  });

  it('retorna IP e user-agent nulos quando ausentes na requisição', () => {
    expect(extractAuditContext(criarRequisicao({ ip: undefined, headers: {} }))).toEqual({
      usuarioId: null,
      operadorPapel: null,
      enderecoIp: null,
      enderecoIpProxy: null,
      userAgent: null,
    });
  });

  it('captura enderecoIpProxy do socket quando disponível', () => {
    const socket = { remoteAddress: '172.20.0.5' };
    const req = { ip: '203.0.113.10', headers: { 'user-agent': 'jest-agent' }, socket } as unknown as Request;

    const ctx = extractAuditContext(req);

    expect(ctx.enderecoIp).toBe('203.0.113.10');
    expect(ctx.enderecoIpProxy).toBe('172.20.0.5');
  });
});
