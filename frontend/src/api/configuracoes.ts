import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient } from './httpClient';
import type { Configuracao } from '@/types/domain';

export interface AtualizarConfiguracaoPayload {
  nomeClinica?: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  emailContato?: string;
  mensagemBemVindo?: string;
}

export function useConfiguracoes() {
  return useQuery({
    queryKey: ['configuracoes'],
    queryFn: async () => {
      const { data } = await httpClient.get<Configuracao>('/configuracoes');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Busca o logo como data URL (base64) — usa auth via httpClient, compatível com <img src>. */
export function useLogoUrl(enabled: boolean) {
  return useQuery({
    queryKey: ['configuracoes', 'logo-data'],
    enabled,
    staleTime: 30 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const response = await httpClient.get('/configuracoes/logo', { responseType: 'blob' });
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(response.data as Blob);
      });
    },
  });
}

export function useAtualizarConfiguracoes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AtualizarConfiguracaoPayload) => {
      const { data } = await httpClient.patch<Configuracao>('/configuracoes', payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
    },
  });
}

export function useConfiguracaoPublica() {
  return useQuery({
    queryKey: ['configuracoes', 'publica'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ nomeClinica: string | null; logoBase64: string | null }>(
        '/configuracoes/publica',
      );
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUploadLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (arquivo: File) => {
      const form = new FormData();
      form.append('arquivo', arquivo);
      const { data } = await httpClient.post<Configuracao>('/configuracoes/logo', form);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
      void queryClient.invalidateQueries({ queryKey: ['configuracoes', 'logo-data'] });
    },
  });
}
