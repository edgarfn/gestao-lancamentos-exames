import { useQuery } from '@tanstack/react-query';
import { httpClient } from './httpClient';
import type { AcaoAuditoria, RegistroAuditoria, ResultadoPaginado } from '@/types/domain';

export interface FiltroAuditoria {
  usuarioId?: string | null;
  acao?: AcaoAuditoria | null;
  entidade?: string | null;
  dataInicio?: string | null;
  dataFim?: string | null;
  pagina?: number;
  tamanhoPagina?: number;
}

function limparFiltro(filtro: FiltroAuditoria): Record<string, unknown> {
  return Object.fromEntries(Object.entries(filtro).filter(([, valor]) => valor !== null && valor !== ''));
}

export function useAuditoria(filtro: FiltroAuditoria) {
  return useQuery({
    queryKey: ['auditoria', filtro],
    queryFn: async () => {
      const { data } = await httpClient.get<ResultadoPaginado<RegistroAuditoria>>('/auditoria', {
        params: limparFiltro(filtro),
      });
      return data;
    },
    placeholderData: (anterior) => anterior,
  });
}

/** Lista os tipos de cadastro com eventos registrados — alimenta o seletor de "tipo de cadastro" no filtro. */
export function useEntidadesAuditoria() {
  return useQuery({
    queryKey: ['auditoria', 'entidades'],
    queryFn: async () => {
      const { data } = await httpClient.get<string[]>('/auditoria/entidades');
      return data;
    },
  });
}
