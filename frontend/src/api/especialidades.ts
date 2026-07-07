import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient } from './httpClient';
import type { Especialidade, ResultadoPaginado } from '@/types/domain';

export interface FiltroEspecialidades {
  busca?: string;
  pagina?: number;
  tamanhoPagina?: number;
}

export interface CriarEspecialidadePayload {
  nome: string;
  descricao?: string;
}

export interface AtualizarEspecialidadePayload {
  nome?: string;
  descricao?: string | null;
  ativo?: boolean;
}

export function useEspecialidades(filtro: FiltroEspecialidades = {}) {
  return useQuery({
    queryKey: ['especialidades', filtro],
    queryFn: async () => {
      const { data } = await httpClient.get<ResultadoPaginado<Especialidade>>('/especialidades', { params: filtro });
      return data;
    },
  });
}

export function useEspecialidadesParaSelecao() {
  return useQuery({
    queryKey: ['especialidades', 'selecao'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ id: string; nome: string }[]>('/especialidades/selecao');
      return data;
    },
  });
}

export function useCriarEspecialidade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CriarEspecialidadePayload) => {
      const { data } = await httpClient.post<Especialidade>('/especialidades', payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['especialidades'] });
    },
  });
}

export function useAtualizarEspecialidade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: AtualizarEspecialidadePayload }) => {
      const { data } = await httpClient.patch<Especialidade>(`/especialidades/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['especialidades'] });
    },
  });
}

export function useRemoverEspecialidade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await httpClient.delete(`/especialidades/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['especialidades'] });
    },
  });
}
