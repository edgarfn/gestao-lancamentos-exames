-- Adiciona as ações de auditoria do novo módulo de backup/restauração
-- (BACKUP_CRIACAO, BACKUP_RESTAURACAO, BACKUP_EXCLUSAO) ao enum existente.
-- ALTER TYPE ... ADD VALUE é seguro dentro de transação no PostgreSQL 12+,
-- desde que o novo valor não seja usado na mesma transação em que é criado.
ALTER TYPE "AcaoAuditoria" ADD VALUE 'BACKUP_CRIACAO';
ALTER TYPE "AcaoAuditoria" ADD VALUE 'BACKUP_RESTAURACAO';
ALTER TYPE "AcaoAuditoria" ADD VALUE 'BACKUP_EXCLUSAO';
