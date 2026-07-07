import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  FileButton,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { isAxiosError } from 'axios';
import {
  IconAlertTriangle,
  IconDatabaseExport,
  IconDatabaseImport,
  IconDownload,
  IconInfoCircle,
  IconLock,
  IconTrash,
} from '@tabler/icons-react';
import { baixarBackup, useBackups, useCriarBackup, useRemoverBackup, useRestaurarBackup } from '@/api/backup';
import type { BackupArquivo } from '@/types/domain';

/**
 * Backup e restauração do banco de dados — restrito a ADMIN/GESTOR.
 *
 * Backups podem ser gerados com criptografia AES-256-GCM opcional (extensão
 * `.dump.enc`). A restauração detecta automaticamente a extensão e descriptografa
 * usando a chave configurada no servidor (DATA_ENCRYPTION_KEY).
 */
export function BackupPage() {
  const { data: backups, isLoading } = useBackups();
  const criarBackup = useCriarBackup();
  const removerBackup = useRemoverBackup();
  const restaurarBackup = useRestaurarBackup();

  const [baixando, setBaixando] = useState<string | null>(null);
  const [criptografar, setCriptografar] = useState(false);

  async function aoGerarBackup() {
    try {
      const arquivo = await criarBackup.mutateAsync({ criptografar });
      notifications.show({
        color: 'green',
        title: 'Backup gerado',
        message: `O arquivo "${arquivo.nome}" foi criado com sucesso.`,
      });
    } catch (erro) {
      notifications.show({ color: 'red', title: 'Não foi possível gerar o backup', message: mensagemDeErro(erro) });
    }
  }

  async function aoBaixar(nome: string) {
    setBaixando(nome);
    try {
      await baixarBackup(nome);
    } catch (erro) {
      notifications.show({ color: 'red', title: 'Não foi possível baixar o backup', message: mensagemDeErro(erro) });
    } finally {
      setBaixando(null);
    }
  }

  function abrirRemocao(arquivo: BackupArquivo) {
    modals.openConfirmModal({
      title: 'Remover backup',
      centered: true,
      labels: { confirm: 'Remover definitivamente', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      children: (
        <Stack gap="sm">
          <Text size="sm">
            Tem certeza de que deseja remover o arquivo de backup <strong>"{arquivo.nome}"</strong>?
          </Text>
          <Alert icon={<IconAlertTriangle size={18} />} color="red" variant="light">
            Esta ação é <strong>irreversível</strong>. O arquivo será apagado permanentemente e não poderá ser
            usado para uma futura restauração.
          </Alert>
        </Stack>
      ),
      onConfirm: () => void aoConfirmarRemocao(arquivo),
    });
  }

  async function aoConfirmarRemocao(arquivo: BackupArquivo) {
    try {
      await removerBackup.mutateAsync(arquivo.nome);
      notifications.show({ color: 'green', title: 'Backup removido', message: 'O arquivo foi apagado com sucesso.' });
    } catch (erro) {
      notifications.show({ color: 'red', title: 'Não foi possível remover o backup', message: mensagemDeErro(erro) });
    }
  }

  function abrirRestauracao(arquivo: File) {
    modals.openConfirmModal({
      title: 'Restaurar banco de dados',
      centered: true,
      labels: { confirm: 'Restaurar e substituir tudo', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      children: (
        <Stack gap="sm">
          <Text size="sm">
            Tem certeza de que deseja restaurar o banco de dados a partir do arquivo{' '}
            <strong>"{arquivo.name}"</strong>?
          </Text>
          <Alert icon={<IconAlertTriangle size={18} />} color="red" variant="light">
            Esta ação é <strong>destrutiva e irreversível</strong>: todos os dados atuais (lançamentos,
            cadastros, usuários, histórico de auditoria etc.) serão <strong>substituídos</strong> pelo
            conteúdo do backup. Gere um backup do estado atual antes de continuar, caso precise dele depois.
          </Alert>
        </Stack>
      ),
      onConfirm: () => void aoConfirmarRestauracao(arquivo),
    });
  }

  async function aoConfirmarRestauracao(arquivo: File) {
    try {
      await restaurarBackup.mutateAsync(arquivo);
      notifications.show({
        color: 'green',
        title: 'Banco de dados restaurado',
        message: 'A restauração foi concluída. Pode ser necessário entrar no sistema novamente.',
      });
    } catch (erro) {
      notifications.show({ color: 'red', title: 'Não foi possível restaurar o backup', message: mensagemDeErro(erro) });
    }
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Backup e Restauração</Title>
      </Group>

      <Text size="sm" c="dimmed">
        Gerencie aqui os backups do banco de dados do sistema. Um backup completo é gerado automaticamente
        todas as madrugadas e os mais antigos são removidos conforme a política de retenção configurada — mas
        você também pode gerar, baixar, remover ou restaurar backups manualmente quando precisar. Toda
        operação realizada aqui é registrada na trilha de auditoria.
      </Text>

      {/* Gerar novo backup */}
      <Card withBorder padding="md">
        <Group justify="space-between" wrap="wrap" gap="md" align="flex-start">
          <Stack gap={4} style={{ flex: 1 }}>
            <Text fw={600}>Gerar novo backup</Text>
            <Text size="sm" c="dimmed">
              Cria imediatamente um arquivo de backup completo do banco de dados (formato compactado .dump).
            </Text>
            <Tooltip
              label="Criptografa o arquivo usando AES-256-GCM. O arquivo gerado terá extensão .dump.enc e só poderá ser restaurado neste servidor com a mesma chave de cifragem."
              multiline
              maw={320}
              withArrow
            >
              <Checkbox
                mt="xs"
                label={
                  <Group gap={6}>
                    <IconLock size={14} />
                    <Text size="sm">Criptografar backup</Text>
                  </Group>
                }
                checked={criptografar}
                onChange={(e) => setCriptografar(e.currentTarget.checked)}
              />
            </Tooltip>
          </Stack>
          <Button
            leftSection={<IconDatabaseExport size={18} />}
            loading={criarBackup.isPending}
            onClick={() => void aoGerarBackup()}
          >
            Gerar backup agora
          </Button>
        </Group>
      </Card>

      {/* Restaurar */}
      <Card withBorder padding="md">
        <Group justify="space-between" wrap="wrap" gap="md" align="flex-start">
          <Stack gap={4} style={{ flex: 1 }}>
            <Text fw={600}>Restaurar a partir de um arquivo</Text>
            <Text size="sm" c="dimmed">
              Envie um arquivo de backup (.dump ou .dump.enc) gerado por este sistema para restaurar o banco de dados.
            </Text>
            <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light" mt="xs">
              Arquivos <strong>.dump.enc</strong> são criptografados e exigem que a chave de cifragem configurada
              no servidor seja a mesma utilizada na criação do backup.
            </Alert>
          </Stack>
          <FileButton onChange={(arquivo) => arquivo && abrirRestauracao(arquivo)} accept=".dump,.dump.enc">
            {(props) => (
              <Button
                {...props}
                variant="outline"
                color="red"
                leftSection={<IconDatabaseImport size={18} />}
                loading={restaurarBackup.isPending}
              >
                Selecionar arquivo e restaurar
              </Button>
            )}
          </FileButton>
        </Group>
      </Card>

      {/* Lista de backups */}
      <Card withBorder padding="md">
        <Text fw={600} mb="md">
          Backups disponíveis
        </Text>

        {isLoading ? (
          <Group justify="center" py="lg">
            <Loader size="sm" />
          </Group>
        ) : !backups || backups.length === 0 ? (
          <Text size="sm" c="dimmed">
            Nenhum backup disponível no momento.
          </Text>
        ) : (
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Arquivo</Table.Th>
                <Table.Th>Tamanho</Table.Th>
                <Table.Th>Gerado em</Table.Th>
                <Table.Th w={120}>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {backups.map((arquivo) => (
                <Table.Tr key={arquivo.nome}>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <Badge variant="light" radius="sm">
                        {arquivo.nome}
                      </Badge>
                      {arquivo.criptografado && (
                        <Tooltip label="Backup criptografado com AES-256-GCM" withArrow>
                          <Badge color="yellow" variant="light" radius="sm" leftSection={<IconLock size={10} />}>
                            Cifrado
                          </Badge>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>{formatarBytes(arquivo.tamanhoBytes)}</Table.Td>
                  <Table.Td>{formatarDataHora(arquivo.criadoEm)}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Tooltip label="Baixar arquivo">
                        <Button
                          size="xs"
                          variant="subtle"
                          loading={baixando === arquivo.nome}
                          onClick={() => void aoBaixar(arquivo.nome)}
                        >
                          <IconDownload size={16} />
                        </Button>
                      </Tooltip>
                      <Tooltip label="Remover backup">
                        <Button size="xs" variant="subtle" color="red" onClick={() => abrirRemocao(arquivo)}>
                          <IconTrash size={16} />
                        </Button>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}

function mensagemDeErro(erro: unknown): string {
  const mensagem = isAxiosError(erro) ? (erro.response?.data as { message?: string } | undefined)?.message : undefined;
  return mensagem ?? 'Tente novamente em instantes.';
}

function formatarBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const unidades = ['KB', 'MB', 'GB', 'TB'];
  let valor = bytes;
  let indice = -1;
  do {
    valor /= 1024;
    indice += 1;
  } while (valor >= 1024 && indice < unidades.length - 1);
  return `${valor.toFixed(1)} ${unidades[indice]}`;
}

function formatarDataHora(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(data));
}
