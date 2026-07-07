import { useMutation, useQuery } from '@tanstack/react-query';
import { httpClient } from './httpClient';

export function useNecessitaConfiguracao() {
  return useQuery({
    queryKey: ['auth', 'precisa-configuracao'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ precisaConfiguracao: boolean }>('/auth/precisa-configuracao');
      return data.precisaConfiguracao;
    },
    staleTime: 60_000,
  });
}

export function useSetupInicial() {
  return useMutation({
    mutationFn: async (payload: { nome: string; email: string; senha: string }) => {
      await httpClient.post('/auth/configuracao-inicial', payload);
    },
  });
}

export function useSolicitarRecuperacao() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await httpClient.post<{ mensagem: string }>('/auth/solicitar-recuperacao', { email });
      return data.mensagem;
    },
  });
}

export function useRedefinirSenha() {
  return useMutation({
    mutationFn: async (payload: { token: string; novaSenha: string }) => {
      await httpClient.post('/auth/redefinir-senha', payload);
    },
  });
}
