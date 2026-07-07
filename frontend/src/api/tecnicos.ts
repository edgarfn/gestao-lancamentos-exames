import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient } from './httpClient';
import type { ResultadoPaginado, Tecnico } from '@/types/domain';

export interface FiltroTecnicos {
  nome?: string;
  pagina?: number;
  tamanhoPagina?: number;
}

export interface CriarTecnicoPayload {
  nome: string;
  documento?: string;
  registroProfissional?: string;
}

/**
 * O CPF (documento) é o identificador estável de deduplicação e não pode
 * ser alterado — espelha a restrição aplicada pelo backend (UpdateTecnicoDto).
 */
export interface AtualizarTecnicoPayload {
  nome?: string;
  registroProfissional?: string;
  ativo?: boolean;
}

export function useTecnicos(filtro: FiltroTecnicos) {
  return useQuery({
    queryKey: ['tecnicos', filtro],
    queryFn: async () => {
      const { data } = await httpClient.get<ResultadoPaginado<Tecnico>>('/tecnicos', { params: filtro });
      return data;
    },
  });
}

/** Lista leve para preencher seletores. */
export function useTecnicosParaSelecao() {
  return useQuery({
    queryKey: ['tecnicos', 'selecao'],
    queryFn: async () => {
      const { data } = await httpClient.get<ResultadoPaginado<Tecnico>>('/tecnicos', {
        params: { ativo: 'true', tamanhoPagina: 100 },
      });
      return data.itens;
    },
  });
}

export function useCriarTecnico() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CriarTecnicoPayload) => {
      const { data } = await httpClient.post<Tecnico>('/tecnicos', payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tecnicos'] });
    },
  });
}

export function useAtualizarTecnico() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: AtualizarTecnicoPayload }) => {
      const { data } = await httpClient.patch<Tecnico>(`/tecnicos/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tecnicos'] });
    },
  });
}

/**
 * Remoção lógica (soft delete): preserva o histórico de lançamentos vinculados
 * (íntegro e auditável) e apenas torna o técnico indisponível para novos
 * registros — espelha o comportamento e o aviso do backend (TecnicosService.remover).
 */
export function useRemoverTecnico() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await httpClient.delete(`/tecnicos/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tecnicos'] });
    },
  });
}
