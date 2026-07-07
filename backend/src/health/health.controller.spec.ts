import { HealthCheckError, HealthCheckService } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaService } from '../common/prisma/prisma.service';

describe('HealthController', () => {
  let health: { check: jest.Mock };
  let prisma: { $queryRaw: jest.Mock };
  let controller: HealthController;

  beforeEach(() => {
    health = {
      check: jest.fn((indicadores: Array<() => unknown>) => Promise.all(indicadores.map((fn) => fn()))),
    };
    prisma = { $queryRaw: jest.fn() };
    controller = new HealthController(
      health as unknown as HealthCheckService,
      prisma as unknown as PrismaService,
    );
  });

  it('reporta o banco de dados "up" quando a consulta de verificação é bem-sucedida', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const resultado = await controller.check();

    expect(resultado).toEqual([{ database: { status: 'up' } }]);
  });

  it('lança HealthCheckError com status "down" e a mensagem de erro quando o banco está indisponível, sem vazar dados sensíveis', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(controller.check()).rejects.toThrow(HealthCheckError);
    await expect(controller.check()).rejects.toMatchObject({
      causes: { database: { status: 'down', message: 'connection refused' } },
    });
  });
});
