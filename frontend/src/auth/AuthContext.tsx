import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { httpClient, registrarCallbackSessaoInvalida } from '@/api/httpClient';
import { tokenStore } from './tokenStore';
import type { Papel, UsuarioAutenticado } from '@/types/domain';

interface RespostaLogin {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioAutenticado;
}

interface AuthContextValue {
  usuario: UsuarioAutenticado | null;
  carregando: boolean;
  entrar: (email: string, senha: string, turnstileToken: string) => Promise<void>;
  sair: () => void;
  possuiPapel: (...papeis: Papel[]) => boolean;
  /** Atualiza os dados do usuário na sessão local (ex.: após editar o próprio nome), sem novo login. */
  atualizarDadosDaSessao: (dados: Partial<UsuarioAutenticado>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioAutenticado | null>(null);
  const [carregando, setCarregando] = useState(true);

  const sair = useCallback(() => {
    tokenStore.limpar();
    setUsuario(null);
  }, []);

  useEffect(() => {
    const sessao = tokenStore.carregar();
    setUsuario(sessao?.usuario ?? null);
    setCarregando(false);
    registrarCallbackSessaoInvalida(sair);
  }, [sair]);

  const entrar = useCallback(async (email: string, senha: string, turnstileToken: string) => {
    const { data } = await httpClient.post<RespostaLogin>('/auth/login', { email, senha, turnstileToken });
    tokenStore.salvar({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      usuario: data.usuario,
    });
    setUsuario(data.usuario);
  }, []);

  const possuiPapel = useCallback(
    (...papeis: Papel[]) => (usuario ? papeis.includes(usuario.papel) : false),
    [usuario],
  );

  const atualizarDadosDaSessao = useCallback((dados: Partial<UsuarioAutenticado>) => {
    setUsuario((atual) => {
      if (!atual) return atual;
      const atualizado = { ...atual, ...dados };
      const sessao = tokenStore.carregar();
      if (sessao) {
        tokenStore.salvar({ ...sessao, usuario: atualizado });
      }
      return atualizado;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ usuario, carregando, entrar, sair, possuiPapel, atualizarDadosDaSessao }),
    [usuario, carregando, entrar, sair, possuiPapel, atualizarDadosDaSessao],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocado deliberadamente com seu provider
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider.');
  }
  return context;
}
