-- CreateTable
CREATE TABLE "especialidades" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "deletado_em" TIMESTAMP(3),

    CONSTRAINT "especialidades_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "exames" ADD COLUMN "especialidade_id" TEXT;

-- CreateIndex
CREATE INDEX "especialidades_nome_idx" ON "especialidades"("nome");

-- CreateIndex
CREATE INDEX "especialidades_deletado_em_idx" ON "especialidades"("deletado_em");

-- CreateIndex
CREATE INDEX "exames_especialidade_id_idx" ON "exames"("especialidade_id");

-- AddForeignKey
ALTER TABLE "exames" ADD CONSTRAINT "exames_especialidade_id_fkey" FOREIGN KEY ("especialidade_id") REFERENCES "especialidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
