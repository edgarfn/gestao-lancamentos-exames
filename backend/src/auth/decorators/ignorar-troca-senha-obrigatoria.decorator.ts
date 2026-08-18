import { SetMetadata } from '@nestjs/common';

export const IGNORAR_TROCA_SENHA_OBRIGATORIA_KEY = 'ignorarTrocaSenhaObrigatoria';

/**
 * Isenta um endpoint do bloqueio aplicado a contas com troca de senha
 * pendente (ver TrocaSenhaObrigatoriaGuard). Use apenas nas rotas
 * estritamente necessárias para o usuário concluir a troca ou sair da
 * conta — nunca em rotas de negócio, para não abrir uma brecha ao
 * bloqueio (secure by default).
 */
export const IgnorarTrocaSenhaObrigatoria = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IGNORAR_TROCA_SENHA_OBRIGATORIA_KEY, true);
