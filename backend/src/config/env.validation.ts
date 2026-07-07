import * as Joi from 'joi';

/**
 * Validação rígida das variáveis de ambiente na inicialização.
 * Falhar cedo (fail-fast) evita subir a aplicação com configuração insegura
 * (ex.: segredos ausentes, chave de cifragem com tamanho incorreto).
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3001),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  DATA_ENCRYPTION_KEY: Joi.string().min(32).required(),

  // Cloudflare Turnstile (CAPTCHA anti-bot no login) — chave secreta usada
  // para validar, no servidor, o token emitido pelo widget no frontend.
  TURNSTILE_SECRET_KEY: Joi.string().required(),

  CORS_ALLOWED_ORIGINS: Joi.string().default(''),

  THROTTLE_TTL_SECONDS: Joi.number().positive().default(60),
  THROTTLE_LIMIT: Joi.number().positive().default(100),
  THROTTLE_LOGIN_LIMIT: Joi.number().positive().default(5),

  DATA_RETENTION_DAYS: Joi.number().positive().default(1825),

  // Diretório onde os arquivos de backup do banco de dados são armazenados
  // (montado como volume persistente — ver docker-compose.yml) e por quantos
  // dias mantê-los antes da limpeza automática da rotina agendada.
  BACKUP_DIR: Joi.string().default('/var/backups/exames'),
  BACKUP_RETENTION_DIAS: Joi.number().positive().default(30),

  // Diretório onde os uploads de configurações (ex.: logotipo da clínica)
  // são armazenados (montado como volume persistente — ver docker-compose.yml).
  CONFIGURACOES_DIR: Joi.string().default('/var/uploads/configuracoes'),

  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),

  // Recuperação de senha por e-mail — opcional. Sem SMTP_HOST o link é apenas logado no console.
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),
  SMTP_FROM: Joi.string().optional(),

  // URL pública do frontend usada para montar o link de recuperação de senha
  FRONTEND_URL: Joi.string().uri().default('http://localhost:8089'),
});
