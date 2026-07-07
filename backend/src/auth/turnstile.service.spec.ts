import { ConfigService } from '@nestjs/config';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  let config: { getOrThrow: jest.Mock };
  let service: TurnstileService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    config = { getOrThrow: jest.fn().mockReturnValue('chave-secreta-de-teste') };
    service = new TurnstileService(config as unknown as ConfigService);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockarResposta(corpo: unknown, ok = true, status = 200) {
    fetchMock.mockResolvedValue({
      ok,
      status,
      json: jest.fn().mockResolvedValue(corpo),
    });
  }

  it('envia o token, a chave secreta e o IP do cliente ao endpoint de verificação da Cloudflare', async () => {
    mockarResposta({ success: true });

    await service.validar('token-do-widget', '203.0.113.10');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: 'chave-secreta-de-teste',
          response: 'token-do-widget',
          remoteip: '203.0.113.10',
        }),
      }),
    );
  });

  it('omite o campo remoteip quando o IP do cliente não está disponível', async () => {
    mockarResposta({ success: true });

    await service.validar('token-do-widget', null);

    const corpoEnviado = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as Record<
      string,
      unknown
    >;
    expect(corpoEnviado).toEqual({ secret: 'chave-secreta-de-teste', response: 'token-do-widget' });
  });

  it('retorna true quando a Cloudflare confirma o desafio (success: true)', async () => {
    mockarResposta({ success: true });

    await expect(service.validar('token-valido', null)).resolves.toBe(true);
  });

  it('retorna false quando a Cloudflare rejeita o desafio (success: false)', async () => {
    mockarResposta({ success: false });

    await expect(service.validar('token-invalido', null)).resolves.toBe(false);
  });

  it('retorna false (fail-closed) quando a Cloudflare responde com status de erro HTTP', async () => {
    mockarResposta({}, false, 503);

    await expect(service.validar('token-qualquer', null)).resolves.toBe(false);
  });

  it('retorna false (fail-closed) quando a chamada de rede falha', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'));

    await expect(service.validar('token-qualquer', null)).resolves.toBe(false);
  });
});
