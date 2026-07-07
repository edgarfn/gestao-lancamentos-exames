import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import type { IncomingMessage } from 'http';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './common/prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { AuditModule } from './common/audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { TecnicosModule } from './tecnicos/tecnicos.module';
import { PacientesModule } from './pacientes/pacientes.module';
import { ExamesModule } from './exames/exames.module';
import { EspecialidadesModule } from './especialidades/especialidades.module';
import { ConveniosModule } from './convenios/convenios.module';
import { LancamentosModule } from './lancamentos/lancamentos.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { RetencaoModule } from './retencao/retencao.module';
import { BackupModule } from './backup/backup.module';
import { ConfiguracoesModule } from './configuracoes/configuracoes.module';
import { HealthModule } from './health/health.module';

const CAMPOS_SENSIVEIS_PARA_REDACAO = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.senha',
  'req.body.senhaAtual',
  'req.body.novaSenha',
  'req.body.refreshToken',
  'req.body.documento',
  'req.body.contato',
  'res.headers["set-cookie"]',
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),

    // Logging estruturado (JSON em produção) com redação automática de
    // campos sensíveis — nunca registramos senhas, tokens ou PII em log,
    // mesmo acidentalmente via payload de requisição (privacy by design).
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL') ?? 'info',
          genReqId: (req: IncomingMessage) => (req.id ? String(req.id) : randomUUID()),
          redact: { paths: CAMPOS_SENSIVEIS_PARA_REDACAO, censor: '[REDACTED]' },
          transport:
            config.get<string>('NODE_ENV') !== 'production'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),

    // Rate limiting global — mitigação de força bruta e abuso de API.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: (config.get<number>('THROTTLE_TTL_SECONDS') ?? 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT') ?? 100,
          },
        ],
      }),
    }),

    ScheduleModule.forRoot(),

    PrismaModule,
    CryptoModule,
    AuditModule,
    AuthModule,
    UsuariosModule,
    TecnicosModule,
    PacientesModule,
    ExamesModule,
    EspecialidadesModule,
    ConveniosModule,
    LancamentosModule,
    AuditoriaModule,
    RetencaoModule,
    BackupModule,
    ConfiguracoesModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
