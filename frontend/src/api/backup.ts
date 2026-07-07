import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { httpClient } from './httpClient';
import type { BackupArquivo } from '@/types/domain';

export function useBackups() {
  return useQuery({
    queryKey: ['backup'],
    queryFn: async () => {
      const { data } = await httpClient.get<BackupArquivo[]>('/backup');
      return data;
    },
  });
}

export function useCriarBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ criptografar }: { criptografar: boolean }) => {
      const { data } = await httpClient.post<BackupArquivo>('/backup', { criptografar });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['backup'] });
    },
  });
}

export function useRemoverBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      await httpClient.delete(`/backup/${encodeURIComponent(nome)}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['backup'] });
    },
  });
}

/** Restaura o banco a partir de um arquivo .dump enviado pelo operador — operação destrutiva e irreversível. */
export function useRestaurarBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (arquivo: File) => {
      const formData = new FormData();
      formData.append('arquivo', arquivo);
      await httpClient.post('/backup/restaurar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}

/** Baixa um arquivo de backup existente e inicia o download no navegador. */
export async function baixarBackup(nome: string): Promise<void> {
  const resposta = await httpClient.get<ArrayBuffer>(`/backup/${encodeURIComponent(nome)}/download`, {
    responseType: 'arraybuffer',
  });

  const url = URL.createObjectURL(new Blob([resposta.data], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
