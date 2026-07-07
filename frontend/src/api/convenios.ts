import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient } from './httpClient';
import type { Convenio, ResultadoPaginado } from '@/types/domain';

export interface FiltroConvenios {
  busca?: string;
  pagina?: number;
  tamanhoPagina?: number;
}

export interface CriarConvenioPayload {
  nome: string;
  descricao?: string;
}

export interface AtualizarConvenioPayload {
  nome?: string;
  descricao?: string | null;
  ativo?: boolean;
}

export function useConvenios(filtro: FiltroConvenios = {}) {
  return useQuery({
    queryKey: ['convenios', filtro],
    queryFn: async () => {
      const { data } = await httpClient.get<ResultadoPaginado<Convenio>>('/convenios', { params: filtro });
      return data;
    },
  });
}

export function useConveniosParaSelecao() {
  return useQuery({
    queryKey: ['convenios', 'selecao'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ id: string; nome: string }[]>('/convenios/selecao');
      return data;
    },
  });
}

export function useCriarConvenio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CriarConvenioPayload) => {
      const { data } = await httpClient.post<Convenio>('/convenios', payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['convenios'] });
    },
  });
}

export function useAtualizarConvenio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: AtualizarConvenioPayload }) => {
      const { data } = await httpClient.patch<Convenio>(`/convenios/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['convenios'] });
    },
  });
}

export function useRemoverConvenio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await httpClient.delete(`/convenios/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['convenios'] });
    },
  });
}
