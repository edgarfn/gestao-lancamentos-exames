import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient } from './httpClient';
import type { Lancamento, PontoEvolucaoMensal, ResultadoPaginado, ResumoLancamentos } from '@/types/domain';

/**
 * Filtros de consulta de lançamentos — espelham exatamente o que o backend
 * aceita (exame, técnico, data [intervalo], paciente), conforme requisito
 * funcional do sistema.
 */
export interface FiltroLancamentos {
  exameId?: string | null;
  tecnicoId?: string | null;
  pacienteId?: string | null;
  especialidadeId?: string | null;
  convenioId?: string | null;
  dataInicio?: string | null;
  dataFim?: string | null;
  pagina?: number;
  tamanhoPagina?: number;
  ordenarPor?: string;
}

export interface CriarLancamentoPayload {
  tecnicoId: string;
  pacienteId: string;
  exameId: string;
  convenioId?: string;
  data: string;
  quantidade: number;
  valor: string;
  observacoes?: string;
}

/**
 * Técnico, paciente e exame não podem ser alterados após o registro — espelha
 * a restrição do backend (UpdateLancamentoDto). Para corrigir um vínculo errado,
 * o fluxo correto é remover o lançamento (preserva auditoria) e criar um novo.
 */
export interface AtualizarLancamentoPayload {
  data?: string;
  quantidade?: number;
  valor?: string;
  observacoes?: string;
}

function limparFiltro(filtro: FiltroLancamentos): Record<string, unknown> {
  return Object.fromEntries(Object.entries(filtro).filter(([, valor]) => valor !== null && valor !== ''));
}

export function useLancamentos(filtro: FiltroLancamentos) {
  return useQuery({
    queryKey: ['lancamentos', filtro],
    queryFn: async () => {
      const { data } = await httpClient.get<ResultadoPaginado<Lancamento>>('/lancamentos', {
        params: limparFiltro(filtro),
      });
      return data;
    },
    placeholderData: (anterior) => anterior,
  });
}

export function useResumoLancamentos(filtro: FiltroLancamentos) {
  return useQuery({
    queryKey: ['lancamentos', 'resumo', filtro],
    queryFn: async () => {
      const { data } = await httpClient.get<ResumoLancamentos>('/lancamentos/resumo', {
        params: limparFiltro(filtro),
      });
      return data;
    },
  });
}

export function useCriarLancamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CriarLancamentoPayload) => {
      const { data } = await httpClient.post<Lancamento>('/lancamentos', payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
    },
  });
}

export function useAtualizarLancamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: AtualizarLancamentoPayload }) => {
      const { data } = await httpClient.patch<Lancamento>(`/lancamentos/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
    },
  });
}

export function useRemoverLancamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await httpClient.delete(`/lancamentos/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
    },
  });
}

/** Dispara a exportação CSV respeitando os filtros ativos e inicia o download no navegador. */
export async function exportarLancamentosCsv(filtro: FiltroLancamentos): Promise<void> {
  const resposta = await httpClient.get<string>('/lancamentos/exportar/csv', {
    params: limparFiltro(filtro),
    responseType: 'text',
  });

  baixarArquivo(
    new Blob([resposta.data], { type: 'text/csv;charset=utf-8' }),
    `lancamentos-${new Date().toISOString().slice(0, 10)}.csv`,
  );
}

/** Gera o relatório em PDF respeitando os filtros ativos e inicia o download no navegador. */
export async function exportarLancamentosPdf(filtro: FiltroLancamentos): Promise<void> {
  const resposta = await httpClient.get<ArrayBuffer>('/lancamentos/exportar/pdf', {
    params: limparFiltro(filtro),
    responseType: 'arraybuffer',
  });

  baixarArquivo(
    new Blob([resposta.data], { type: 'application/pdf' }),
    `relatorio-lancamentos-${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}

export interface FiltroEvolucaoMensal {
  tecnicoId?: string | null;
  especialidadeId?: string | null;
}

export function useEvolucaoMensal(filtro: FiltroEvolucaoMensal) {
  return useQuery({
    queryKey: ['lancamentos', 'evolucao-mensal', filtro],
    queryFn: async () => {
      const params = Object.fromEntries(
        Object.entries(filtro).filter(([, v]) => v !== null && v !== undefined && v !== ''),
      );
      const { data } = await httpClient.get<PontoEvolucaoMensal[]>('/lancamentos/evolucao-mensal', { params });
      return data;
    },
    staleTime: 60_000,
  });
}

function baixarArquivo(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
