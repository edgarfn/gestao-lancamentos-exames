import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient } from './httpClient';
import type { Paciente, ResultadoPaginado } from '@/types/domain';

export interface FiltroPacientes {
  nome?: string;
  pagina?: number;
  tamanhoPagina?: number;
}

export interface CriarPacientePayload {
  nome: string;
  documento?: string;
  dataNascimento?: string;
  contato?: string;
}

/**
 * CPF e data de nascimento são identificadores estáveis e imutáveis após o
 * cadastro — espelha a restrição do backend (UpdatePacienteDto).
 */
export interface AtualizarPacientePayload {
  nome?: string;
  contato?: string;
}

export function usePacientes(filtro: FiltroPacientes) {
  return useQuery({
    queryKey: ['pacientes', filtro],
    queryFn: async () => {
      const { data } = await httpClient.get<ResultadoPaginado<Paciente>>('/pacientes', { params: filtro });
      return data;
    },
  });
}

/** Lista leve para preencher seletores. */
export function usePacientesParaSelecao(busca: string) {
  return useQuery({
    queryKey: ['pacientes', 'selecao', busca],
    queryFn: async () => {
      const { data } = await httpClient.get<ResultadoPaginado<Paciente>>('/pacientes', {
        params: { nome: busca || undefined, tamanhoPagina: 20 },
      });
      return data.itens;
    },
    enabled: busca.length >= 2,
  });
}

export function useCriarPaciente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CriarPacientePayload) => {
      const { data } = await httpClient.post<Paciente>('/pacientes', payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pacientes'] });
    },
  });
}

export function useAtualizarPaciente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: AtualizarPacientePayload }) => {
      const { data } = await httpClient.patch<Paciente>(`/pacientes/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pacientes'] });
    },
  });
}

/** Remoção lógica (soft delete): preserva o histórico clínico/financeiro vinculado. */
export function useRemoverPaciente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await httpClient.delete(`/pacientes/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pacientes'] });
    },
  });
}

/**
 * Implementa o "direito ao esquecimento" (LGPD art. 18) — substitui os dados
 * pessoais identificáveis por marcadores irreversíveis. Operação irreversível:
 * a interface deve confirmar explicitamente antes de chamá-la.
 */
export function useAnonimizarPaciente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await httpClient.post(`/pacientes/${id}/anonimizar`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pacientes'] });
    },
  });
}
