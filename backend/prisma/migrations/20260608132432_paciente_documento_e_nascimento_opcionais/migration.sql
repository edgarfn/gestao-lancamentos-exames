-- AlterTable
ALTER TABLE "pacientes" ALTER COLUMN "documento_cifrado" DROP NOT NULL,
ALTER COLUMN "documento_hash" DROP NOT NULL,
ALTER COLUMN "data_nascimento" DROP NOT NULL;
