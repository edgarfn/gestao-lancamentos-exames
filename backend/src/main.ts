import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // Confia em qualquer proxy reverso "interno" (faixas de IP privadas/loopback do
  // Docker), em vez de um número fixo de saltos. Motivo: a topologia de proxies
  // muda conforme o deploy — só Nginx (docker-compose.yml) ou Caddy + Nginx
  // (overlay docker-compose.https.yml, usado em produção com HTTPS) — e um número
  // fixo (ex.: 1) fica incorreto sempre que a contagem real de saltos for
  // diferente. Com 2 proxies reais (Caddy → Nginx) e apenas 1 salto confiado,
  // req.ip resolvia para o IP interno do Caddy em vez do IP real do cliente —
  // causa raiz do IP incorreto exibido na página de Auditoria.
  // Os presets abaixo (proxy-addr) confiam em qualquer IP privado/loopback da
  // cadeia — sempre os containers Docker internos — e param no primeiro IP
  // público encontrado, que é sempre o cliente real: um IP público da Internet
  // nunca cai nessas faixas, então não é possível se passar por um salto confiado
  // forjando X-Forwarded-For.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  const config = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Cabeçalhos de segurança HTTP (mitiga XSS, clickjacking, sniffing, etc.)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    }),
  );

  // CORS restrito a origens explicitamente configuradas
  const allowedOrigins = (config.get<string>('CORS_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  // Validação global de entrada — bloqueia campos não esperados (whitelist)
  // e converte tipos de forma segura, prevenindo payloads malformados/maliciosos.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');

  if (config.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Sistema de Gestão de Lançamentos de Exames — API')
      .setDescription(
        'API para registro e consulta de lançamentos de exames (Técnico, Paciente, Exame, Data, Quantidade, Valor).',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);
  logger.log(`Aplicação iniciada na porta ${port}`);
}

void bootstrap();
