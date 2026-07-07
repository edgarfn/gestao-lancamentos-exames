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
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { isAxiosError } from 'axios';
import { IconEdit, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';
import { useAtualizarTecnico, useCriarTecnico, useRemoverTecnico, useTecnicos } from '@/api/tecnicos';
import type { Tecnico } from '@/types/domain';
import { useAuth } from '@/auth/AuthContext';
import { ConfirmarRemocaoCadastro } from '@/components/ConfirmarRemocaoCadastro';

interface FormValues {
  nome: string;
  documento: string;
  registroProfissional: string;
}

interface FormEdicaoValues {
  nome: string;
  registroProfissional: string;
  ativo: boolean;
}

export function TecnicosPage() {
  const [busca, setBusca] = useState('');
  const [buscaDebounced] = useDebouncedValue(busca, 300);
  const [modalAberto, setModalAberto] = useState(false);
  const [tecnicoEmEdicao, setTecnicoEmEdicao] = useState<Tecnico | null>(null);
  const [tecnicoParaRemover, setTecnicoParaRemover] = useState<Tecnico | null>(null);

  const { possuiPapel } = useAuth();
  const podeCadastrar = possuiPapel('ADMIN', 'GESTOR');
  const podeEditar = possuiPapel('ADMIN', 'GESTOR');
  const podeRemover = possuiPapel('ADMIN', 'GESTOR');

  const { data: resultado, isLoading } = useTecnicos({
    nome: buscaDebounced || undefined,
    tamanhoPagina: 50,
  });
  const criarTecnico = useCriarTecnico();
  const atualizarTecnico = useAtualizarTecnico();
  const removerTecnico = useRemoverTecnico();

  const form = useForm<FormValues>({
    initialValues: { nome: '', documento: '', registroProfissional: '' },
    validate: {
      nome: (valor) => (valor.trim().length >= 3 ? null : 'Informe o nome completo do técnico.'),
      documento: (valor) => {
        const digitos = valor.replace(/\D/g, '');
        if (!digitos) return null;
        return /^\d{11}$/.test(digitos) ? null : 'Informe um CPF válido (somente números).';
      },
      registroProfissional: (valor) => {
        if (!valor.trim()) return null;
        return valor.trim().length >= 3 ? null : 'Registro deve ter ao menos 3 caracteres.';
      },
    },
  });

  const formEdicao = useForm<FormEdicaoValues>({
    initialValues: { nome: '', registroProfissional: '', ativo: true },
    validate: {
      nome: (valor) => (valor.trim().length >= 3 ? null : 'Informe o nome completo do técnico.'),
      registroProfissional: (valor) => {
        if (!valor.trim()) return null;
        return valor.trim().length >= 3 ? null : 'Registro deve ter ao menos 3 caracteres.';
      },
    },
  });

  async function aoSubmeter(valores: FormValues) {
    try {
      const documentoDigitos = valores.documento.replace(/\D/g, '');
      await criarTecnico.mutateAsync({
        nome: valores.nome,
        documento: documentoDigitos || undefined,
        registroProfissional: valores.registroProfissional.trim() || undefined,
      });
      notifications.show({
        color: 'green',
        title: 'Técnico cadastrado',
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
        title: 'Não foi possível cadastrar o técnico',
        message: mensagem ?? 'Verifique os dados informados e tente novamente.',
      });
    }
  }

  function abrirEdicao(tecnico: Tecnico) {
    setTecnicoEmEdicao(tecnico);
    formEdicao.setValues({
      nome: tecnico.nome,
      registroProfissional: tecnico.registroProfissional ?? '',
      ativo: tecnico.ativo,
    });
  }

  async function aoSalvarEdicao(valores: FormEdicaoValues) {
    if (!tecnicoEmEdicao) return;
    try {
      await atualizarTecnico.mutateAsync({
        id: tecnicoEmEdicao.id,
        payload: {
          nome: valores.nome,
          registroProfissional: valores.registroProfissional.trim() || undefined,
          ativo: valores.ativo,
        },
      });
      notifications.show({
        color: 'green',
        title: 'Técnico atualizado',
        message: 'As alterações foram salvas com sucesso.',
      });
      setTecnicoEmEdicao(null);
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
    if (!tecnicoParaRemover) return;
    try {
      await removerTecnico.mutateAsync(tecnicoParaRemover.id);
      notifications.show({
        color: 'green',
        title: 'Técnico removido',
        message: 'O cadastro foi inativado e o histórico de lançamentos foi preservado.',
      });
      setTecnicoParaRemover(null);
    } catch (erro) {
      const mensagem = isAxiosError(erro)
        ? (erro.response?.data as { message?: string } | undefined)?.message
        : undefined;
      notifications.show({
        color: 'red',
        title: 'Não foi possível remover o técnico',
        message: mensagem ?? 'Tente novamente em instantes.',
      });
    }
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Técnicos</Title>
        {podeCadastrar && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => setModalAberto(true)}>
            Novo técnico
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

        <Table.ScrollContainer minWidth={500}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Registro profissional</Table.Th>
                <Table.Th>Status</Table.Th>
                {(podeEditar || podeRemover) && <Table.Th />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(resultado?.itens ?? []).map((tecnico) => (
                <Table.Tr key={tecnico.id}>
                  <Table.Td>{tecnico.nome}</Table.Td>
                  <Table.Td>{tecnico.registroProfissional ?? '—'}</Table.Td>
                  <Table.Td>
                    <Badge color={tecnico.ativo ? 'green' : 'gray'} variant="light">
                      {tecnico.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </Table.Td>
                  {(podeEditar || podeRemover) && (
                    <Table.Td>
                      <Group gap={4} justify="flex-end">
                        {podeEditar && (
                          <Tooltip label="Editar cadastro">
                            <ActionIcon variant="subtle" onClick={() => abrirEdicao(tecnico)}>
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {podeRemover && (
                          <Tooltip label="Remover cadastro">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => setTecnicoParaRemover(tecnico)}
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
            Nenhum técnico encontrado.
          </Text>
        )}
      </Card>

      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title="Novo técnico" centered>
        <form onSubmit={form.onSubmit(aoSubmeter)}>
          <Stack>
            <TextInput label="Nome completo" required {...form.getInputProps('nome')} />
            <TextInput
              label="CPF"
              placeholder="Somente números (opcional)"
              {...form.getInputProps('documento')}
            />
            <TextInput
              label="Registro profissional"
              placeholder="Ex.: COREN-SP 123456 (opcional)"
              {...form.getInputProps('registroProfissional')}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={criarTecnico.isPending}>
                Cadastrar
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={tecnicoEmEdicao !== null}
        onClose={() => setTecnicoEmEdicao(null)}
        title="Editar técnico"
        centered
      >
        <form onSubmit={formEdicao.onSubmit(aoSalvarEdicao)}>
          <Stack>
            <Text size="xs" c="dimmed">
              O CPF é um identificador estável e não pode ser alterado — caso esteja incorreto, remova este
              cadastro e crie um novo, preservando a trilha de auditoria.
            </Text>
            <TextInput label="Nome completo" required {...formEdicao.getInputProps('nome')} />
            <TextInput
              label="Registro profissional"
              placeholder="Ex.: COREN-SP 123456 (opcional)"
              {...formEdicao.getInputProps('registroProfissional')}
            />
            <Switch
              label="Cadastro ativo"
              description="Técnicos inativos não aparecem para seleção em novos lançamentos, mas o histórico é mantido."
              checked={formEdicao.values.ativo}
              onChange={(evento) => formEdicao.setFieldValue('ativo', evento.currentTarget.checked)}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setTecnicoEmEdicao(null)}>
                Cancelar
              </Button>
              <Button type="submit" loading={atualizarTecnico.isPending}>
                Salvar alterações
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {tecnicoParaRemover && (
        <ConfirmarRemocaoCadastro
          aberto={tecnicoParaRemover !== null}
          aoFechar={() => setTecnicoParaRemover(null)}
          entidade="técnico"
          nomeRegistro={tecnicoParaRemover.nome}
          filtroVinculos={{ tecnicoId: tecnicoParaRemover.id }}
          aoConfirmar={aoConfirmarRemocao}
          confirmando={removerTecnico.isPending}
        />
      )}
    </Stack>
  );
}
