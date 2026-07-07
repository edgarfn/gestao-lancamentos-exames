import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ENDPOINT_VERIFICACAO = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface RespostaSiteverify {
  success: boolean;
}

/**
 * Valida no servidor o token emitido pelo desafio Cloudflare Turnstile
 * (proteção anti-bot exibida no login). A validação feita no navegador é
 * apenas uma camada de UX — só a confirmação aqui, junto à Cloudflare, tem
 * valor de segurança.
 */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly config: ConfigService) {}

  async validar(token: string, enderecoIp: string | null): Promise<boolean> {
    const secretKey = this.config.getOrThrow<string>('TURNSTILE_SECRET_KEY');

    try {
      const resposta = await fetch(ENDPOINT_VERIFICACAO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: secretKey,
          response: token,
          ...(enderecoIp ? { remoteip: enderecoIp } : {}),
        }),
      });

      if (!resposta.ok) {
        this.logger.warn(`Verificação Turnstile respondeu com status HTTP ${resposta.status}.`);
        return false;
      }

      const corpo = (await resposta.json()) as RespostaSiteverify;
      return corpo.success === true;
    } catch (erro) {
      // Fail-closed: indisponibilidade da Cloudflare ou erro de rede é tratada
      // como verificação inválida — preferível bloquear um login legítimo
      // ocasional a desativar silenciosamente uma proteção contra bots.
      this.logger.error({ err: erro as Error }, 'Falha ao validar token Turnstile');
      return false;
    }
  }
}
