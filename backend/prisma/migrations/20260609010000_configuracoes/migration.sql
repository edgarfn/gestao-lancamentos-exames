CREATE TABLE "configuracoes" (
  "id" TEXT NOT NULL,
  "nome_clinica" TEXT,
  "cnpj" TEXT,
  "endereco" TEXT,
  "telefone" TEXT,
  "email_contato" TEXT,
  "logo_nome" TEXT,
  "mensagem_bem_vindo" TEXT,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "configuracoes_pkey" PRIMARY KEY ("id")
);
