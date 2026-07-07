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
  useAtualizarConvenio,
  useCriarConvenio,
  useConvenios,
  useRemoverConvenio,
} from '@/api/convenios';
import type { Convenio } from '@/types/domain';
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

export function ConveniosPage() {
  const [busca, setBusca] = useState('');
  const [buscaDebounced] = useDebouncedValue(busca, 300);
  const [modalAberto, setModalAberto] = useState(false);
  const [convenioEmEdicao, setConvenioEmEdicao] = useState<Convenio | null>(null);

  const { possuiPapel } = useAuth();
  const podeCadastrar = possuiPapel('ADMIN', 'GESTOR');
  const podeEditar = possuiPapel('ADMIN', 'GESTOR');
  const podeRemover = possuiPapel('ADMIN', 'GESTOR');

  const { data: resultado, isLoading } = useConvenios({ busca: buscaDebounced || undefined, tamanhoPagina: 50 });
  const criarConvenio = useCriarConvenio();
  const atualizarConvenio = useAtualizarConvenio();
  const removerConvenio = useRemoverConvenio();

  const formCriacao = useForm<FormCriacaoValues>({
    initialValues: { nome: '', descricao: '' },
    validate: {
      nome: (valor) => (valor.trim().length >= 2 ? null : 'Informe o nome do convênio (mínimo 2 caracteres).'),
    },
  });

  const formEdicao = useForm<FormEdicaoValues>({
    initialValues: { nome: '', descricao: '', ativo: true },
    validate: {
      nome: (valor) => (valor.trim().length >= 2 ? null : 'Informe o nome do convênio (mínimo 2 caracteres).'),
    },
  });

  async function aoSubmeterCriacao(valores: FormCriacaoValues) {
    try {
      await criarConvenio.mutateAsync({
        nome: valores.nome,
        ...(valores.descricao.trim() ? { descricao: valores.descricao.trim() } : {}),
      });
      notifications.show({ color: 'green', title: 'Convênio cadastrado', message: 'Cadastro realizado com sucesso.' });
      formCriacao.reset();
      setModalAberto(false);
    } catch (erro) {
      notifications.show({
        color: 'red',
        title: 'Não foi possível cadastrar o convênio',
        message: mensagemDeErro(erro),
      });
    }
  }

  function abrirEdicao(convenio: Convenio) {
    setConvenioEmEdicao(convenio);
    formEdicao.setValues({
      nome: convenio.nome,
      descricao: convenio.descricao ?? '',
      ativo: convenio.ativo,
    });
  }

  async function aoSalvarEdicao(valores: FormEdicaoValues) {
    if (!convenioEmEdicao) return;
    try {
      await atualizarConvenio.mutateAsync({
        id: convenioEmEdicao.id,
        payload: {
          nome: valores.nome,
          descricao: valores.descricao.trim() || null,
          ativo: valores.ativo,
        },
      });
      notifications.show({ color: 'green', title: 'Convênio atualizado', message: 'As alterações foram salvas.' });
      setConvenioEmEdicao(null);
    } catch (erro) {
      notifications.show({
        color: 'red',
        title: 'Não foi possível salvar as alterações',
        message: mensagemDeErro(erro),
      });
    }
  }

  function abrirRemocao(convenio: Convenio) {
    modals.openConfirmModal({
      title: 'Remover convênio',
      centered: true,
      labels: { confirm: 'Remover', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      children: (
        <Text size="sm">
          Tem certeza de que deseja remover o convênio <strong>"{convenio.nome}"</strong>? Os lançamentos
          vinculados perderão este convênio, mas o histórico será mantido.
        </Text>
      ),
      onConfirm: () => void aoConfirmarRemocao(convenio.id),
    });
  }

  async function aoConfirmarRemocao(id: string) {
    try {
      await removerConvenio.mutateAsync(id);
      notifications.show({ color: 'green', title: 'Convênio removido', message: 'O cadastro foi removido.' });
    } catch (erro) {
      notifications.show({
        color: 'red',
        title: 'Não foi possível remover o convênio',
        message: mensagemDeErro(erro),
      });
    }
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Convênios</Title>
        {podeCadastrar && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => setModalAberto(true)}>
            Novo convênio
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
              {(resultado?.itens ?? []).map((conv) => (
                <Table.Tr key={conv.id}>
                  <Table.Td fw={500}>{conv.nome}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" lineClamp={1}>
                      {conv.descricao ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={conv.ativo ? 'green' : 'gray'} variant="light">
                      {conv.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </Table.Td>
                  {(podeEditar || podeRemover) && (
                    <Table.Td>
                      <Group gap={4} justify="flex-end">
                        {podeEditar && (
                          <Tooltip label="Editar cadastro">
                            <ActionIcon variant="subtle" onClick={() => abrirEdicao(conv)}>
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {podeRemover && (
                          <Tooltip label="Remover cadastro">
                            <ActionIcon variant="subtle" color="red" onClick={() => abrirRemocao(conv)}>
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
            Nenhum convênio encontrado.
          </Text>
        )}
      </Card>

      {/* Modal de criação */}
      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title="Novo convênio" centered>
        <form onSubmit={formCriacao.onSubmit(aoSubmeterCriacao)}>
          <Stack>
            <TextInput label="Nome" placeholder="Ex.: Unimed" required {...formCriacao.getInputProps('nome')} />
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
              <Button type="submit" loading={criarConvenio.isPending}>Cadastrar</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal de edição */}
      <Modal
        opened={convenioEmEdicao !== null}
        onClose={() => setConvenioEmEdicao(null)}
        title="Editar convênio"
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
              label="Convênio ativo"
              description="Convênios inativos não aparecem para seleção em novos lançamentos."
              checked={formEdicao.values.ativo}
              onChange={(evento) => formEdicao.setFieldValue('ativo', evento.currentTarget.checked)}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setConvenioEmEdicao(null)}>Cancelar</Button>
              <Button type="submit" loading={atualizarConvenio.isPending}>Salvar alterações</Button>
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
