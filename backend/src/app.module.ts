import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
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
  // Cabeçalhos de autenticação/sessão
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  // Senhas e credenciais em corpo de requisição
  'req.body.senha',
  'req.body.senhaAtual',
  'req.body.novaSenha',
  'req.body.confirmarSenha',
  'req.body.senhaInicial',
  // Tokens de sessão e recuperação
  'req.body.refreshToken',
  'req.body.token',
  'req.body.turnstileToken',
  // Dados pessoais sensíveis (PII — LGPD)
  'req.body.documento',
  'req.body.contato',
  // Campos internos que nunca devem vazar nos logs
  'req.body.senhaHash',
  'req.body.tokenHash',
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
          // Adiciona userId ao log de cada requisição HTTP. O hook é chamado
          // após a resposta ser enviada — nesse momento req.user já foi
          // populado pelos guards de autenticação.
          customProps: (req: IncomingMessage, _res: ServerResponse) => ({
            userId: (req as IncomingMessage & { user?: { id?: string } }).user?.id ?? null,
          }),
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
  providers: [
    // Filter global: captura todas as exceções não tratadas e loga com
    // contexto estruturado (reqId, userId, path, statusCode, stack).
    // Registrado antes dos guards para garantir cobertura total.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
