import type { UsuarioAutenticado } from '@/types/domain';

export interface SessaoArmazenada {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioAutenticado;
}

const CHAVE_SESSAO = 'exames:sessao';

/**
 * Armazena a sessão em sessionStorage (não em localStorage): os dados são
 * apagados ao fechar a aba/navegador, reduzindo a janela de exposição em
 * caso de acesso físico ao dispositivo. Ainda assim, qualquer storage
 * acessível via JavaScript é vulnerável a XSS — por isso o app aplica CSP
 * estrita (ver index.html) e o backend faz output-encoding via React.
 * Em um endurecimento futuro, considere mover o refresh token para um
 * cookie httpOnly + SameSite=Strict emitido pelo backend.
 */
export const tokenStore = {
  salvar(sessao: SessaoArmazenada): void {
    sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
  },

  carregar(): SessaoArmazenada | null {
    const bruto = sessionStorage.getItem(CHAVE_SESSAO);
    if (!bruto) return null;
    try {
      return JSON.parse(bruto) as SessaoArmazenada;
    } catch {
      sessionStorage.removeItem(CHAVE_SESSAO);
      return null;
    }
  },

  limpar(): void {
    sessionStorage.removeItem(CHAVE_SESSAO);
  },
};
