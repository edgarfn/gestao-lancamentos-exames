import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

/**
 * Implementação Redis do ThrottlerStorage para ambientes distribuídos
 * (múltiplas instâncias do backend compartilham o mesmo contador de hits).
 *
 * Pipeline atômico: INCR + PTTL em um único round-trip garante que não
 * haja race condition entre contagem e expiração em alta concorrência.
 *
 * Namespacing: prefixo "rl:<throttlerName>:<key>" separa os contadores por
 * throttler nomeado, evitando colisão entre regras "global" vs. outras.
 */
export class ThrottlerRedisStorage implements ThrottlerStorage {
  private readonly logger = new Logger(ThrottlerRedisStorage.name);
  readonly connection: Redis;

  constructor(url: string) {
    this.connection = new Redis(url, {
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: (attempt) => {
        if (attempt >= 4) return null; // desiste após 4 tentativas
        return 250 * 2 ** attempt; // backoff exponencial: 500ms, 1s, 2s, 4s
      },
    });

    this.connection.on('connect', () =>
      this.logger.log('Redis conectado — rate limiting distribuído ativo'),
    );
    this.connection.on('error', (err: Error) =>
      this.logger.error({ err }, 'Erro na conexão Redis (rate limiting)'),
    );
    this.connection.on('reconnecting', (delay: number) =>
      this.logger.warn(`Reconectando ao Redis em ${delay}ms`),
    );

    void this.connection.connect().catch(() => {
      // erro já capturado pelo handler 'error' acima
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitKey = `rl:${throttlerName}:${key}`;
    const blockKey = `rl:block:${throttlerName}:${key}`;

    // 1. Verifica bloqueio explícito ainda ativo
    const blockPttl = await this.connection.pttl(blockKey);
    if (blockPttl > 0) {
      return {
        totalHits: limit + 1,
        timeToExpire: blockPttl,
        isBlocked: true,
        timeToBlockExpire: blockPttl,
      };
    }

    // 2. Incrementa e lê TTL remanescente de forma atômica
    const pipeline = this.connection.pipeline();
    pipeline.incr(hitKey);
    pipeline.pttl(hitKey);
    const results = (await pipeline.exec()) ?? [];

    const totalHits = (results[0]?.[1] as number | null) ?? 1;
    const currentPttl = (results[1]?.[1] as number | null) ?? -1;

    // Expiration set only on first hit of the window
    if (totalHits === 1 || currentPttl < 0) {
      await this.connection.pexpire(hitKey, ttl);
    }

    const timeToExpire = currentPttl > 0 ? currentPttl : ttl;
    const isBlocked = totalHits > limit;

    // 3. Registra bloqueio temporário (impede novas tentativas mesmo após
    //    a janela original expirar, se blockDuration > 0)
    if (isBlocked && blockDuration > 0) {
      await this.connection.set(blockKey, '1', 'PX', blockDuration);
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire: isBlocked ? (blockDuration > 0 ? blockDuration : timeToExpire) : 0,
    };
  }

  disconnect(): void {
    this.connection.disconnect();
  }
}
