import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Endpoint de verificação de saúde para orquestradores (Docker/Kubernetes)
 * e monitoramento. Não exige autenticação (rota operacional), porém não
 * expõe nenhuma informação sensível — apenas o status de conectividade.
 */
@ApiTags('Saúde')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.checkDatabase()]);
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    const key = 'database';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { [key]: { status: 'up' } };
    } catch (error) {
      throw new HealthCheckError('Banco de dados indisponível', {
        [key]: { status: 'down', message: (error as Error).message },
      });
    }
  }
}
