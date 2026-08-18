import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { tokenStore } from '@/auth/tokenStore';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/v1';

export const httpClient = axios.create({ baseURL });

let renovacaoEmAndamento: Promise<string | null> | null = null;

/** Permite que o AuthProvider seja notificado quando a sessão se torna inválida (ex.: refresh falhou). */
let aoDeslogarPorSessaoInvalida: (() => void) | null = null;
export function registrarCallbackSessaoInvalida(callback: () => void): void {
  aoDeslogarPorSessaoInvalida = callback;
}

const CODIGO_SENHA_TROCA_OBRIGATORIA = 'SENHA_TROCA_OBRIGATORIA';

/**
 * Permite que o AuthProvider seja notificado quando o backend bloqueia uma
 * requisição por troca de senha pendente (TrocaSenhaObrigatoriaGuard) — cobre
 * o caso de a sessão local ainda não saber da pendência (ex.: um
 * administrador redefiniu a senha desta conta enquanto ela estava em uso
 * em outra aba/dispositivo).
 */
let aoReceberSenhaTrocaObrigatoria: (() => void) | null = null;
export function registrarCallbackSenhaTrocaObrigatoria(callback: () => void): void {
  aoReceberSenhaTrocaObrigatoria = callback;
}

httpClient.interceptors.request.use((config) => {
  const sessao = tokenStore.carregar();
  if (sessao?.accessToken) {
    config.headers.set('Authorization', `Bearer ${sessao.accessToken}`);
  }
  return config;
});

async function renovarTokens(): Promise<string | null> {
  const sessao = tokenStore.carregar();
  if (!sessao?.refreshToken) return null;

  try {
    const resposta = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${baseURL}/auth/refresh`,
      { refreshToken: sessao.refreshToken },
    );
    const novaSessao = { ...sessao, ...resposta.data };
    tokenStore.salvar(novaSessao);
    return novaSessao.accessToken;
  } catch {
    tokenStore.limpar();
    aoDeslogarPorSessaoInvalida?.();
    return null;
  }
}

httpClient.interceptors.response.use(
  (resposta) => resposta,
  async (erro: AxiosError) => {
    const config = erro.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const statusNaoAutorizado = erro.response?.status === 401;
    const ehRotaDeAuth = config?.url?.includes('/auth/');

    const codigoErro = (erro.response?.data as { code?: string } | undefined)?.code;
    if (erro.response?.status === 403 && codigoErro === CODIGO_SENHA_TROCA_OBRIGATORIA) {
      aoReceberSenhaTrocaObrigatoria?.();
    }

    if (statusNaoAutorizado && config && !config._retry && !ehRotaDeAuth) {
      config._retry = true;

      // Evita múltiplas renovações concorrentes (request collapsing).
      renovacaoEmAndamento ??= renovarTokens().finally(() => {
        renovacaoEmAndamento = null;
      });

      const novoToken = await renovacaoEmAndamento;
      if (novoToken) {
        config.headers.set('Authorization', `Bearer ${novoToken}`);
        return httpClient(config);
      }
    }

    return Promise.reject(erro);
  },
);
