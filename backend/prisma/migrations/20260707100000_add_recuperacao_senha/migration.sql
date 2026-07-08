-- AlterEnum: ADD VALUE é idempotente no PostgreSQL >= 9.6 para valores já existentes,
-- mas lança erro se tentado duas vezes sem IF NOT EXISTS (disponível no PG 12+).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RECUPERACAO_SENHA'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AcaoAuditoria')) THEN
    ALTER TYPE "AcaoAuditoria" ADD VALUE 'RECUPERACAO_SENHA';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CONFIGURACAO_INICIAL'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'AcaoAuditoria')) THEN
    ALTER TYPE "AcaoAuditoria" ADD VALUE 'CONFIGURACAO_INICIAL';
  END IF;
END $$;

-- CreateTable (idempotente)
CREATE TABLE IF NOT EXISTS "tokens_recuperacao_senha" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_recuperacao_senha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotente)
CREATE UNIQUE INDEX IF NOT EXISTS "tokens_recuperacao_senha_token_hash_key" ON "tokens_recuperacao_senha"("token_hash");

-- CreateIndex (idempotente)
CREATE INDEX IF NOT EXISTS "tokens_recuperacao_senha_usuario_id_idx" ON "tokens_recuperacao_senha"("usuario_id");

-- AddForeignKey (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tokens_recuperacao_senha_usuario_id_fkey'
  ) THEN
    ALTER TABLE "tokens_recuperacao_senha" ADD CONSTRAINT "tokens_recuperacao_senha_usuario_id_fkey"
      FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
