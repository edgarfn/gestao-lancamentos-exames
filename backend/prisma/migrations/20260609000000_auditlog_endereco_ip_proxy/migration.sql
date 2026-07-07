-- Adiciona coluna endereco_ip_proxy à tabela audit_logs.
-- Registra o IP direto da conexão TCP (proxy reverso / container Docker),
-- separando-o do IP real do cliente (endereco_ip), resolvido via X-Forwarded-For.
ALTER TABLE "audit_logs" ADD COLUMN "endereco_ip_proxy" TEXT;
