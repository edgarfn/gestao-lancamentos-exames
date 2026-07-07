import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Encapsula o PrismaClient como provider do Nest, gerenciando o ciclo de vida
 * da conexão com o PostgreSQL. Centralizar o acesso facilita aplicar
 * políticas (ex.: timeouts, soft delete) de forma consistente.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
