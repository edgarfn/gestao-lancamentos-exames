import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient } from './httpClient';
import type { Papel, Usuario } from '@/types/domain';

export interface CriarUsuarioPayload {
  nome: string;
  email: string;
  papel: Papel;
  senha: string;
}

/** O e-mail é o identificador de login e não pode ser alterado — espelha a restrição do backend (UpdateUsuarioDto). */
export interface AtualizarUsuarioPayload {
  nome?: string;
  papel?: Papel;
  ativo?: boolean;
  registroProfissional?: string;
}

export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const { data } = await httpClient.get<Usuario[]>('/usuarios');
      return data;
    },
  });
}

export function useCriarUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CriarUsuarioPayload) => {
      const { data } = await httpClient.post<Usuario>('/usuarios', payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });
}

export function useAtualizarUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: AtualizarUsuarioPayload }) => {
      const { data } = await httpClient.patch<Usuario>(`/usuarios/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });
}

/** Gera uma senha temporária aleatória, força a troca no próximo acesso e revoga sessões ativas. */
export function useRedefinirSenhaUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await httpClient.post<{ senhaTemporaria: string }>(`/usuarios/${id}/redefinir-senha`);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });
}

/** Apenas o nome pode ser alterado pelo próprio usuário — papel, status e e-mail são exclusivos do ADMIN. */
export interface AtualizarPerfilProprioPayload {
  nome: string;
}

/** Consulta o cadastro do usuário autenticado (autoatendimento, sem exigir papel ADMIN). */
export function useMeuPerfil() {
  return useQuery({
    queryKey: ['usuarios', 'me'],
    queryFn: async () => {
      const { data } = await httpClient.get<Usuario>('/usuarios/me');
      return data;
    },
  });
}

export function useAtualizarMeuPerfil() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AtualizarPerfilProprioPayload) => {
      const { data } = await httpClient.patch<Usuario>('/usuarios/me', payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['usuarios', 'me'] });
    },
  });
}

export interface AlterarSenhaPayload {
  senhaAtual: string;
  novaSenha: string;
}

/** Troca a própria senha — exige a senha atual e revoga as demais sessões ativas. */
export function useAlterarMinhaSenha() {
  return useMutation({
    mutationFn: async (payload: AlterarSenhaPayload) => {
      await httpClient.post('/auth/alterar-senha', payload);
    },
  });
}
