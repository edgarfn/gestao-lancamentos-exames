import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { isAxiosError } from 'axios';
import { IconEdit, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';
import {
  useAtualizarEspecialidade,
  useCriarEspecialidade,
  useEspecialidades,
  useRemoverEspecialidade,
} from '@/api/especialidades';
import type { Especialidade } from '@/types/domain';
import { useAuth } from '@/auth/AuthContext';

interface FormCriacaoValues {
  nome: string;
  descricao: string;
}

interface FormEdicaoValues {
  nome: string;
  descricao: string;
  ativo: boolean;
}

export function EspecialidadesPage() {
  const [busca, setBusca] = useState('');
  const [buscaDebounced] = useDebouncedValue(busca, 300);
  const [modalAberto, setModalAberto] = useState(false);
  const [especialidadeEmEdicao, setEspecialidadeEmEdicao] = useState<Especialidade | null>(null);

  const { possuiPapel } = useAuth();
  const podeCadastrar = possuiPapel('ADMIN', 'GESTOR');
  const podeEditar = possuiPapel('ADMIN', 'GESTOR');
  const podeRemover = possuiPapel('ADMIN', 'GESTOR');

  const { data: resultado, isLoading } = useEspecialidades({ busca: buscaDebounced || undefined, tamanhoPagina: 50 });
  const criarEspecialidade = useCriarEspecialidade();
  const atualizarEspecialidade = useAtualizarEspecialidade();
  const removerEspecialidade = useRemoverEspecialidade();

  const formCriacao = useForm<FormCriacaoValues>({
    initialValues: { nome: '', descricao: '' },
    validate: {
      nome: (valor) => (valor.trim().length >= 2 ? null : 'Informe o nome da especialidade (mínimo 2 caracteres).'),
    },
  });

  const formEdicao = useForm<FormEdicaoValues>({
    initialValues: { nome: '', descricao: '', ativo: true },
    validate: {
      nome: (valor) => (valor.trim().length >= 2 ? null : 'Informe o nome da especialidade (mínimo 2 caracteres).'),
    },
  });

  async function aoSubmeterCriacao(valores: FormCriacaoValues) {
    try {
      await criarEspecialidade.mutateAsync({
        nome: valores.nome,
        ...(valores.descricao.trim() ? { descricao: valores.descricao.trim() } : {}),
      });
      notifications.show({ color: 'green', title: 'Especialidade cadastrada', message: 'Cadastro realizado com sucesso.' });
      formCriacao.reset();
      setModalAberto(false);
    } catch (erro) {
      notifications.show({
        color: 'red',
        title: 'Não foi possível cadastrar a especialidade',
        message: mensagemDeErro(erro),
      });
    }
  }

  function abrirEdicao(especialidade: Especialidade) {
    setEspecialidadeEmEdicao(especialidade);
    formEdicao.setValues({
      nome: especialidade.nome,
      descricao: especialidade.descricao ?? '',
      ativo: especialidade.ativo,
    });
  }

  async function aoSalvarEdicao(valores: FormEdicaoValues) {
    if (!especialidadeEmEdicao) return;
    try {
      await atualizarEspecialidade.mutateAsync({
        id: especialidadeEmEdicao.id,
        payload: {
          nome: valores.nome,
          descricao: valores.descricao.trim() || null,
          ativo: valores.ativo,
        },
      });
      notifications.show({ color: 'green', title: 'Especialidade atualizada', message: 'As alterações foram salvas.' });
      setEspecialidadeEmEdicao(null);
    } catch (erro) {
      notifications.show({
        color: 'red',
        title: 'Não foi possível salvar as alterações',
        message: mensagemDeErro(erro),
      });
    }
  }

  function abrirRemocao(especialidade: Especialidade) {
    modals.openConfirmModal({
      title: 'Remover especialidade',
      centered: true,
      labels: { confirm: 'Remover', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      children: (
        <Text size="sm">
          Tem certeza de que deseja remover a especialidade <strong>"{especialidade.nome}"</strong>? Os exames vinculados
          perderão esta especialidade, mas o histórico de lançamentos será mantido.
        </Text>
      ),
      onConfirm: () => void aoConfirmarRemocao(especialidade.id),
    });
  }

  async function aoConfirmarRemocao(id: string) {
    try {
      await removerEspecialidade.mutateAsync(id);
      notifications.show({ color: 'green', title: 'Especialidade removida', message: 'O cadastro foi removido.' });
    } catch (erro) {
      notifications.show({
        color: 'red',
        title: 'Não foi possível remover a especialidade',
        message: mensagemDeErro(erro),
      });
    }
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Especialidades</Title>
        {podeCadastrar && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => setModalAberto(true)}>
            Nova especialidade
          </Button>
        )}
      </Group>

      <Card withBorder padding="md">
        <TextInput
          placeholder="Buscar por nome…"
          leftSection={<IconSearch size={16} />}
          value={busca}
          onChange={(evento) => setBusca(evento.currentTarget.value)}
          mb="md"
          maw={360}
        />

        <Table.ScrollContainer minWidth={400}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Descrição</Table.Th>
                <Table.Th>Status</Table.Th>
                {(podeEditar || podeRemover) && <Table.Th />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(resultado?.itens ?? []).map((esp) => (
                <Table.Tr key={esp.id}>
                  <Table.Td fw={500}>{esp.nome}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" lineClamp={1}>
                      {esp.descricao ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={esp.ativo ? 'green' : 'gray'} variant="light">
                      {esp.ativo ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </Table.Td>
                  {(podeEditar || podeRemover) && (
                    <Table.Td>
                      <Group gap={4} justify="flex-end">
                        {podeEditar && (
                          <Tooltip label="Editar cadastro">
                            <ActionIcon variant="subtle" onClick={() => abrirEdicao(esp)}>
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {podeRemover && (
                          <Tooltip label="Remover cadastro">
                            <ActionIcon variant="subtle" color="red" onClick={() => abrirRemocao(esp)}>
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        {!isLoading && (resultado?.itens.length ?? 0) === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            Nenhuma especialidade encontrada.
          </Text>
        )}
      </Card>

      {/* Modal de criação */}
      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title="Nova especialidade" centered>
        <form onSubmit={formCriacao.onSubmit(aoSubmeterCriacao)}>
          <Stack>
            <TextInput label="Nome" placeholder="Ex.: Hematologia" required {...formCriacao.getInputProps('nome')} />
            <Textarea
              label="Descrição"
              placeholder="Breve descrição (opcional)"
              autosize
              minRows={2}
              maxRows={4}
              {...formCriacao.getInputProps('descricao')}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setModalAberto(false)}>Cancelar</Button>
              <Button type="submit" loading={criarEspecialidade.isPending}>Cadastrar</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal de edição */}
      <Modal
        opened={especialidadeEmEdicao !== null}
        onClose={() => setEspecialidadeEmEdicao(null)}
        title="Editar especialidade"
        centered
      >
        <form onSubmit={formEdicao.onSubmit(aoSalvarEdicao)}>
          <Stack>
            <TextInput label="Nome" required {...formEdicao.getInputProps('nome')} />
            <Textarea
              label="Descrição"
              placeholder="Breve descrição (opcional)"
              autosize
              minRows={2}
              maxRows={4}
              {...formEdicao.getInputProps('descricao')}
            />
            <Switch
              label="Especialidade ativa"
              description="Especialidades inativas não aparecem para seleção em novos exames."
              checked={formEdicao.values.ativo}
              onChange={(evento) => formEdicao.setFieldValue('ativo', evento.currentTarget.checked)}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setEspecialidadeEmEdicao(null)}>Cancelar</Button>
              <Button type="submit" loading={atualizarEspecialidade.isPending}>Salvar alterações</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}

function mensagemDeErro(erro: unknown): string {
  const msg = isAxiosError(erro) ? (erro.response?.data as { message?: string } | undefined)?.message : undefined;
  return msg ?? 'Verifique os dados e tente novamente.';
}
