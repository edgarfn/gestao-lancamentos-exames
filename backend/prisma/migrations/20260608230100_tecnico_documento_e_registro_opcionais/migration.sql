-- AlterTable: tornar documento_cifrado, documento_hash e registro_profissional
-- opcionais no cadastro de técnicos (anteriormente NOT NULL).
-- documento_hash mantém o índice UNIQUE — o PostgreSQL trata NULLs como distintos,
-- portanto múltiplos técnicos sem CPF continuam permitidos.
ALTER TABLE "tecnicos" ALTER COLUMN "documento_cifrado" DROP NOT NULL;
ALTER TABLE "tecnicos" ALTER COLUMN "documento_hash" DROP NOT NULL;
ALTER TABLE "tecnicos" ALTER COLUMN "registro_profissional" DROP NOT NULL;
