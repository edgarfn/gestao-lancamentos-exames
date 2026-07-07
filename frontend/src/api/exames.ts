import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient } from './httpClient';
import type { Exame, ResultadoPaginado } from '@/types/domain';

export interface FiltroExames {
  busca?: string;
  pagina?: number;
  tamanhoPagina?: number;
}

export interface CriarExamePayload {
  nome: string;
  codigo: string;
  valorPadrao: string;
  especialidadeId?: string | null;
}

/** O código do exame é um identificador estável e imutável — espelha a restrição do backend (UpdateExameDto). */
export interface AtualizarExamePayload {
  nome?: string;
  valorPadrao?: string;
  ativo?: boolean;
  especialidadeId?: string | null;
}

export function useExames(filtro: FiltroExames) {
  return useQuery({
    queryKey: ['exames', filtro],
    queryFn: async () => {
      const { data } = await httpClient.get<ResultadoPaginado<Exame>>('/exames', { params: filtro });
      return data;
    },
  });
}

/** Lista leve para preencher seletores (sem paginação visível ao usuário). */
export function useExamesParaSelecao() {
  return useQuery({
    queryKey: ['exames', 'selecao'],
    queryFn: async () => {
      const { data } = await httpClient.get<ResultadoPaginado<Exame>>('/exames', {
        params: { ativo: 'true', tamanhoPagina: 100 },
      });
      return data.itens;
    },
  });
}

export function useCriarExame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CriarExamePayload) => {
      const { data } = await httpClient.post<Exame>('/exames', payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exames'] });
    },
  });
}

export function useAtualizarExame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: AtualizarExamePayload }) => {
      const { data } = await httpClient.patch<Exame>(`/exames/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exames'] });
    },
  });
}

/** Remoção lógica (soft delete): preserva o histórico de lançamentos vinculados ao exame. */
export function useRemoverExame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await httpClient.delete(`/exames/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exames'] });
    },
  });
}
