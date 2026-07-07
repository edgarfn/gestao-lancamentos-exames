import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { isAxiosError } from 'axios';
import { IconEdit, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';
import { useAtualizarExame, useCriarExame, useExames, useRemoverExame } from '@/api/exames';
import { useEspecialidadesParaSelecao } from '@/api/especialidades';
import type { Exame } from '@/types/domain';
import { useAuth } from '@/auth/AuthContext';
import { ConfirmarRemocaoCadastro } from '@/components/ConfirmarRemocaoCadastro';

interface FormValues {
  nome: string;
  codigo: string;
  valorPadrao: number | '';
  especialidadeId: string | null;
}

interface FormEdicaoValues {
  nome: string;
  valorPadrao: number | '';
  ativo: boolean;
  especialidadeId: string | null;
}

export function ExamesPage() {
  const [busca, setBusca] = useState('');
  const [buscaDebounced] = useDebouncedValue(busca, 300);
  const [modalAberto, setModalAberto] = useState(false);
  const [exameEmEdicao, setExameEmEdicao] = useState<Exame | null>(null);
  const [exameParaRemover, setExameParaRemover] = useState<Exame | null>(null);

  const { possuiPapel } = useAuth();
  const podeCadastrar = possuiPapel('ADMIN', 'GESTOR');
  const podeEditar = possuiPapel('ADMIN', 'GESTOR');
  const podeRemover = possuiPapel('ADMIN', 'GESTOR');

  const { data: resultado, isLoading } = useExames({ busca: buscaDebounced || undefined, tamanhoPagina: 50 });
  const { data: especialidades } = useEspecialidadesParaSelecao();
  const criarExame = useCriarExame();
  const atualizarExame = useAtualizarExame();
  const removerExame = useRemoverExame();

  const form = useForm<FormValues>({
    initialValues: { nome: '', codigo: '', valorPadrao: '', especialidadeId: null },
    validate: {
      nome: (valor) => (valor.trim().length >= 2 ? null : 'Informe o nome do exame.'),
      codigo: (valor) =>
        /^[A-Z0-9._-]{2,20}$/i.test(valor) ? null : 'Informe um código curto (letras, números, - . _).',
      valorPadrao: (valor) => (valor !== '' && Number(valor) >= 0 ? null : 'Informe um valor padrão válido.'),
      especialidadeId: (valor) => (valor ? null : 'Selecione a especialidade do exame.'),
    },
  });

  const formEdicao = useForm<FormEdicaoValues>({
    initialValues: { nome: '', valorPadrao: '', ativo: true, especialidadeId: null },
    validate: {
      nome: (valor) => (valor.trim().length >= 2 ? null : 'Informe o nome do exame.'),
      valorPadrao: (valor) => (valor !== '' && Number(valor) >= 0 ? null : 'Informe um valor padrão válido.'),
      especialidadeId: (valor) => (valor ? null : 'Selecione a especialidade do exame.'),
    },
  });

  async function aoSubmeter(valores: FormValues) {
    try {
      await criarExame.mutateAsync({
        nome: valores.nome,
        codigo: valores.codigo.toUpperCase(),
        valorPadrao: String(valores.valorPadrao),
        especialidadeId: valores.especialidadeId,
      });
      notifications.show({
        color: 'green',
        title: 'Exame cadastrado',
        message: 'Cadastro realizado com sucesso.',
      });
      form.reset();
      setModalAberto(false);
    } catch (erro) {
      const mensagem = isAxiosError(erro)
        ? (erro.response?.data as { message?: string } | undefined)?.message
        : undefined;
      notifications.show({
        color: 'red',
        title: 'Não foi possível cadastrar o exame',
        message: mensagem ?? 'Verifique os dados informados e tente novamente.',
      });
    }
  }

  function abrirEdicao(exame: Exame) {
    setExameEmEdicao(exame);
    formEdicao.setValues({
      nome: exame.nome,
      valorPadrao: Number(exame.valorPadrao),
      ativo: exame.ativo,
      especialidadeId: exame.especialidade?.id ?? null,
    });
  }

  async function aoSalvarEdicao(valores: FormEdicaoValues) {
    if (!exameEmEdicao) return;
    try {
      await atualizarExame.mutateAsync({
        id: exameEmEdicao.id,
        payload: {
          nome: valores.nome,
          valorPadrao: String(valores.valorPadrao),
          ativo: valores.ativo,
          especialidadeId: valores.especialidadeId,
        },
      });
      notifications.show({
        color: 'green',
        title: 'Exame atualizado',
        message: 'As alterações foram salvas com sucesso.',
      });
      setExameEmEdicao(null);
    } catch (erro) {
      const mensagem = isAxiosError(erro)
        ? (erro.response?.data as { message?: string } | undefined)?.message
        : undefined;
      notifications.show({
        color: 'red',
        title: 'Não foi possível salvar as alterações',
        message: mensagem ?? 'Verifique os dados informados e tente novamente.',
      });
    }
  }

  async function aoConfirmarRemocao() {
    if (!exameParaRemover) return;
    try {
      await removerExame.mutateAsync(exameParaRemover.id);
      notifications.show({
        color: 'green',
        title: 'Exame removido',
        message: 'O cadastro foi inativado e o histórico de lançamentos foi preservado.',
      });
      setExameParaRemover(null);
    } catch (erro) {
      const mensagem = isAxiosError(erro)
        ? (erro.response?.data as { message?: string } | undefined)?.message
        : undefined;
      notifications.show({
        color: 'red',
        title: 'Não foi possível remover o exame',
        message: mensagem ?? 'Tente novamente em instantes.',
      });
    }
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Catálogo de exames</Title>
        {podeCadastrar && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => setModalAberto(true)}>
            Novo exame
          </Button>
        )}
      </Group>

      <Card withBorder padding="md">
        <TextInput
          placeholder="Buscar por nome ou código…"
          leftSection={<IconSearch size={16} />}
          value={busca}
          onChange={(evento) => setBusca(evento.currentTarget.value)}
          mb="md"
          maw={360}
        />

        <Table.ScrollContainer minWidth={500}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Código</Table.Th>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Especialidade</Table.Th>
                <Table.Th>Valor padrão</Table.Th>
                <Table.Th>Status</Table.Th>
                {(podeEditar || podeRemover) && <Table.Th />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(resultado?.itens ?? []).map((exame) => (
                <Table.Tr key={exame.id}>
                  <Table.Td>
                    <Badge variant="light">{exame.codigo}</Badge>
                  </Table.Td>
                  <Table.Td>{exame.nome}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c={exame.especialidade ? undefined : 'dimmed'}>
                      {exame.especialidade?.nome ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>{formatarMoeda(exame.valorPadrao)}</Table.Td>
                  <Table.Td>
                    <Badge color={exame.ativo ? 'green' : 'gray'} variant="light">
                      {exame.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </Table.Td>
                  {(podeEditar || podeRemover) && (
                    <Table.Td>
                      <Group gap={4} justify="flex-end">
                        {podeEditar && (
                          <Tooltip label="Editar cadastro">
                            <ActionIcon variant="subtle" onClick={() => abrirEdicao(exame)}>
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {podeRemover && (
                          <Tooltip label="Remover cadastro">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => setExameParaRemover(exame)}
                            >
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
            Nenhum exame encontrado.
          </Text>
        )}
      </Card>

      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title="Novo exame" centered>
        <form onSubmit={form.onSubmit(aoSubmeter)}>
          <Stack>
            <TextInput label="Nome do exame" required {...form.getInputProps('nome')} />
            <TextInput
              label="Código"
              placeholder="Ex.: HEMO-001"
              required
              {...form.getInputProps('codigo')}
            />
            <NumberInput
              label="Valor padrão (R$)"
              required
              min={0}
              decimalScale={2}
              fixedDecimalScale
              decimalSeparator=","
              thousandSeparator="."
              {...form.getInputProps('valorPadrao')}
            />
            <Select
              label="Especialidade"
              placeholder="Selecione a especialidade"
              required
              searchable
              data={(especialidades ?? []).map((e) => ({ value: e.id, label: e.nome }))}
              value={form.values.especialidadeId}
              onChange={(valor) => form.setFieldValue('especialidadeId', valor)}
              error={form.errors.especialidadeId}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={criarExame.isPending}>
                Cadastrar
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={exameEmEdicao !== null}
        onClose={() => setExameEmEdicao(null)}
        title="Editar exame"
        centered
      >
        <form onSubmit={formEdicao.onSubmit(aoSalvarEdicao)}>
          <Stack>
            <Text size="xs" c="dimmed">
              O código do exame é um identificador estável e não pode ser alterado — caso esteja incorreto,
              remova este cadastro e crie um novo, preservando a trilha de auditoria.
            </Text>
            <TextInput label="Nome do exame" required {...formEdicao.getInputProps('nome')} />
            <NumberInput
              label="Valor padrão (R$)"
              required
              min={0}
              decimalScale={2}
              fixedDecimalScale
              decimalSeparator=","
              thousandSeparator="."
              {...formEdicao.getInputProps('valorPadrao')}
            />
            <Select
              label="Especialidade"
              placeholder="Selecione a especialidade"
              required
              searchable
              data={(especialidades ?? []).map((e) => ({ value: e.id, label: e.nome }))}
              value={formEdicao.values.especialidadeId}
              onChange={(valor) => formEdicao.setFieldValue('especialidadeId', valor)}
              error={formEdicao.errors.especialidadeId}
            />
            <Switch
              label="Cadastro ativo"
              description="Exames inativos não aparecem para seleção em novos lançamentos, mas o histórico é mantido."
              checked={formEdicao.values.ativo}
              onChange={(evento) => formEdicao.setFieldValue('ativo', evento.currentTarget.checked)}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setExameEmEdicao(null)}>
                Cancelar
              </Button>
              <Button type="submit" loading={atualizarExame.isPending}>
                Salvar alterações
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {exameParaRemover && (
        <ConfirmarRemocaoCadastro
          aberto={exameParaRemover !== null}
          aoFechar={() => setExameParaRemover(null)}
          entidade="exame"
          nomeRegistro={exameParaRemover.nome}
          filtroVinculos={{ exameId: exameParaRemover.id }}
          aoConfirmar={aoConfirmarRemocao}
          confirmando={removerExame.isPending}
        />
      )}
    </Stack>
  );
}

function formatarMoeda(valor: string): string {
  const numero = Number(valor);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(numero) ? numero : 0,
  );
}
