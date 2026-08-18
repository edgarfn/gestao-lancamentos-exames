-- Adiciona a coluna precisa_trocar_senha à tabela usuarios.
-- Marca contas cuja senha atual foi definida por um administrador (criação
-- ou redefinição) e ainda não foi trocada pelo próprio usuário — usada para
-- forçar a troca de senha no primeiro acesso (ver TrocaSenhaObrigatoriaGuard).
ALTER TABLE "usuarios" ADD COLUMN "precisa_trocar_senha" BOOLEAN NOT NULL DEFAULT false;
