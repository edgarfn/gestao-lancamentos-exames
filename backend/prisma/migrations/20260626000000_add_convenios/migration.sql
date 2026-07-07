-- CreateTable
CREATE TABLE "convenios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "deletado_em" TIMESTAMP(3),

    CONSTRAINT "convenios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "convenios_nome_idx" ON "convenios"("nome");

-- CreateIndex
CREATE INDEX "convenios_deletado_em_idx" ON "convenios"("deletado_em");

-- AlterTable
ALTER TABLE "lancamentos" ADD COLUMN "convenio_id" TEXT;

-- CreateIndex
CREATE INDEX "lancamentos_convenio_id_idx" ON "lancamentos"("convenio_id");

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_convenio_id_fkey" FOREIGN KEY ("convenio_id") REFERENCES "convenios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
