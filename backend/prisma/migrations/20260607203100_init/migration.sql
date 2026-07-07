-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'GESTOR', 'TECNICO');

-- CreateEnum
CREATE TYPE "AcaoAuditoria" AS ENUM ('CRIACAO', 'LEITURA', 'ATUALIZACAO', 'EXCLUSAO', 'EXPORTACAO', 'LOGIN', 'LOGIN_FALHO', 'ANONIMIZACAO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'TECNICO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao_sessao" INTEGER NOT NULL DEFAULT 1,
    "ultimo_login_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tecnicos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "documento_cifrado" TEXT NOT NULL,
    "documento_hash" TEXT NOT NULL,
    "registro_profissional" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "usuario_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "deletado_em" TIMESTAMP(3),

    CONSTRAINT "tecnicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacientes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "documento_cifrado" TEXT NOT NULL,
    "documento_hash" TEXT NOT NULL,
    "data_nascimento" DATE NOT NULL,
    "contato_cifrado" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "deletado_em" TIMESTAMP(3),
    "anonimizado_em" TIMESTAMP(3),

    CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exames" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "valor_padrao" DECIMAL(10,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "deletado_em" TIMESTAMP(3),

    CONSTRAINT "exames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamentos" (
    "id" TEXT NOT NULL,
    "tecnico_id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "exame_id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "observacoes" TEXT,
    "criado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "deletado_em" TIMESTAMP(3),

    CONSTRAINT "lancamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "acao" "AcaoAuditoria" NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT,
    "dados_antigos" JSONB,
    "dados_novos" JSONB,
    "endereco_ip" TEXT,
    "user_agent" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tecnicos_documento_hash_key" ON "tecnicos"("documento_hash");

-- CreateIndex
CREATE UNIQUE INDEX "tecnicos_usuario_id_key" ON "tecnicos"("usuario_id");

-- CreateIndex
CREATE INDEX "tecnicos_nome_idx" ON "tecnicos"("nome");

-- CreateIndex
CREATE INDEX "tecnicos_deletado_em_idx" ON "tecnicos"("deletado_em");

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_documento_hash_key" ON "pacientes"("documento_hash");

-- CreateIndex
CREATE INDEX "pacientes_nome_idx" ON "pacientes"("nome");

-- CreateIndex
CREATE INDEX "pacientes_deletado_em_idx" ON "pacientes"("deletado_em");

-- CreateIndex
CREATE UNIQUE INDEX "exames_codigo_key" ON "exames"("codigo");

-- CreateIndex
CREATE INDEX "exames_nome_idx" ON "exames"("nome");

-- CreateIndex
CREATE INDEX "exames_deletado_em_idx" ON "exames"("deletado_em");

-- CreateIndex
CREATE INDEX "lancamentos_exame_id_data_idx" ON "lancamentos"("exame_id", "data");

-- CreateIndex
CREATE INDEX "lancamentos_tecnico_id_data_idx" ON "lancamentos"("tecnico_id", "data");

-- CreateIndex
CREATE INDEX "lancamentos_paciente_id_data_idx" ON "lancamentos"("paciente_id", "data");

-- CreateIndex
CREATE INDEX "lancamentos_data_idx" ON "lancamentos"("data");

-- CreateIndex
CREATE INDEX "lancamentos_deletado_em_idx" ON "lancamentos"("deletado_em");

-- CreateIndex
CREATE INDEX "audit_logs_entidade_entidade_id_idx" ON "audit_logs"("entidade", "entidade_id");

-- CreateIndex
CREATE INDEX "audit_logs_usuario_id_criado_em_idx" ON "audit_logs"("usuario_id", "criado_em");

-- CreateIndex
CREATE INDEX "audit_logs_criado_em_idx" ON "audit_logs"("criado_em");

-- AddForeignKey
ALTER TABLE "tecnicos" ADD CONSTRAINT "tecnicos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_tecnico_id_fkey" FOREIGN KEY ("tecnico_id") REFERENCES "tecnicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_exame_id_fkey" FOREIGN KEY ("exame_id") REFERENCES "exames"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
