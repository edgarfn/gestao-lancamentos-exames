import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { isAxiosError } from 'axios';
import {
  IconAlertTriangle,
  IconEdit,
  IconPlus,
  IconSearch,
  IconShieldLock,
  IconTrash,
} from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';
import {
  useAnonimizarPaciente,
  useAtualizarPaciente,
  useCriarPaciente,
  usePacientes,
  useRemoverPaciente,
} from '@/api/pacientes';
import type { Paciente } from '@/types/domain';
import { useAuth } from '@/auth/AuthContext';
import { ConfirmarRemocaoCadastro } from '@/components/ConfirmarRemocaoCadastro';

interface FormValues {
  nome: string;
  documento: string;
  dataNascimento: Date | null;
  contato: string;
}

interface FormEdicaoValues {
  nome: string;
  contato: string;
}

export function PacientesPage() {
  const [busca, setBusca] = useState('');
  const [buscaDebounced] = useDebouncedValue(busca, 300);
  const [modalAberto, setModalAberto] = useState(false);
  const [pacienteEmEdicao, setPacienteEmEdicao] = useState<Paciente | null>(null);
  const [pacienteParaRemover, setPacienteParaRemover] = useState<Paciente | null>(null);

  const { possuiPapel } = useAuth();
  const podeCadastrar = possuiPapel('ADMIN', 'GESTOR', 'TECNICO');
  const podeEditar = possuiPapel('ADMIN', 'GESTOR');
  const podeRemover = possuiPapel('ADMIN', 'GESTOR');
  const podeAnonimizar = possuiPapel('ADMIN', 'GESTOR');

  const { data: resultado, isLoading } = usePacientes({
    nome: buscaDebounced || undefined,
    tamanhoPagina: 50,
  });
  const criarPaciente = useCriarPaciente();
  const atualizarPaciente = useAtualizarPaciente();
  const removerPaciente = useRemoverPaciente();
  const anonimizarPaciente = useAnonimizarPaciente();

  const form = useForm<FormValues>({
    initialValues: { nome: '', documento: '', dataNascimento: null, contato: '' },
    validate: {
      nome: (valor) => (valor.trim().length >= 3 ? null : 'Informe o nome completo do paciente.'),
      documento: (valor) =>
        !valor || /^\d{11}$/.test(valor.replace(/\D/g, '')) ? null : 'Informe um CPF válido (somente números) ou deixe em branco.',
    },
  });

  const formEdicao = useForm<FormEdicaoValues>({
    initialValues: { nome: '', contato: '' },
    validate: {
      nome: (valor) => (valor.trim().length >= 3 ? null : 'Informe o nome completo do paciente.'),
    },
  });

  async function aoSubmeter(valores: FormValues) {
    try {
      await criarPaciente.mutateAsync({
        nome: valores.nome,
        documento: valores.documento ? valores.documento.replace(/\D/g, '') : undefined,
        dataNascimento: valores.dataNascimento ? formatarData(valores.dataNascimento) : undefined,
        contato: valores.contato || undefined,
      });
      notifications.show({
        color: 'green',
        title: 'Paciente cadastrado',
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
        title: 'Não foi possível cadastrar o paciente',
        message: mensagem ?? 'Verifique os dados informados e tente novamente.',
      });
    }
  }

  function abrirEdicao(paciente: Paciente) {
    setPacienteEmEdicao(paciente);
    formEdicao.setValues({ nome: paciente.nome, contato: paciente.contato ?? '' });
  }

  async function aoSalvarEdicao(valores: FormEdicaoValues) {
    if (!pacienteEmEdicao) return;
    try {
      await atualizarPaciente.mutateAsync({
        id: pacienteEmEdicao.id,
        payload: { nome: valores.nome, contato: valores.contato || undefined },
      });
      notifications.show({
        color: 'green',
        title: 'Paciente atualizado',
        message: 'As alterações foram salvas com sucesso.',
      });
      setPacienteEmEdicao(null);
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
    if (!pacienteParaRemover) return;
    try {
      await removerPaciente.mutateAsync(pacienteParaRemover.id);
      notifications.show({
        color: 'green',
        title: 'Paciente removido',
        message: 'O cadastro foi inativado e o histórico de lançamentos foi preservado.',
      });
      setPacienteParaRemover(null);
    } catch (erro) {
      const mensagem = isAxiosError(erro)
        ? (erro.response?.data as { message?: string } | undefined)?.message
        : undefined;
      notifications.show({
        color: 'red',
        title: 'Não foi possível remover o paciente',
        message: mensagem ?? 'Tente novamente em instantes.',
      });
    }
  }

  function abrirAnonimizacao(paciente: Paciente) {
    modals.openConfirmModal({
      title: 'Anonimizar dados do paciente',
      centered: true,
      labels: { confirm: 'Anonimizar definitivamente', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      children: (
        <Stack gap="sm">
          <Text size="sm">
            Tem certeza de que deseja anonimizar o cadastro de <strong>"{paciente.nome}"</strong>?
          </Text>
          <Alert icon={<IconAlertTriangle size={18} />} color="red" variant="light">
            Esta ação é <strong>irreversível</strong>. Nome, CPF e contato serão substituídos por dados
            anônimos permanentemente — não é possível recuperá-los depois. O histórico de lançamentos é
            preservado, mas deixará de identificar o paciente.
          </Alert>
          <Text size="xs" c="dimmed">
            Use esta opção apenas para atender a uma solicitação de exclusão de dados pessoais amparada pela
            LGPD (direito ao esquecimento). A ação fica registrada na trilha de auditoria.
          </Text>
        </Stack>
      ),
      onConfirm: () => void aoConfirmarAnonimizacao(paciente),
    });
  }

  async function aoConfirmarAnonimizacao(paciente: Paciente) {
    try {
      await anonimizarPaciente.mutateAsync(paciente.id);
      notifications.show({
        color: 'green',
        title: 'Paciente anonimizado',
        message: 'Os dados pessoais foram removidos permanentemente, conforme solicitado.',
      });
    } catch (erro) {
      const mensagem = isAxiosError(erro)
        ? (erro.response?.data as { message?: string } | undefined)?.message
        : undefined;
      notifications.show({
        color: 'red',
        title: 'Não foi possível anonimizar o paciente',
        message: mensagem ?? 'Tente novamente em instantes.',
      });
    }
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Pacientes</Title>
        {podeCadastrar && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => setModalAberto(true)}>
            Novo paciente
          </Button>
        )}
      </Group>

      <Card withBorder padding="md">
        <Text size="xs" c="dimmed" mb="xs">
          Por proteção de dados (LGPD), CPF, data de nascimento e contato são opcionais — informe-os apenas
          quando fizer sentido. O CPF nunca é exibido na interface; quando informado, é usado internamente
          apenas para evitar cadastros duplicados.
        </Text>
        <TextInput
          placeholder="Buscar por nome (mín. 2 letras)…"
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
                <Table.Th>Data de nascimento</Table.Th>
                <Table.Th>Contato</Table.Th>
                <Table.Th>Status</Table.Th>
                {(podeEditar || podeRemover || podeAnonimizar) && <Table.Th />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(resultado?.itens ?? []).map((paciente) => {
                const acoesDesabilitadas = paciente.anonimizado;
                return (
                  <Table.Tr key={paciente.id}>
                    <Table.Td>{paciente.nome}</Table.Td>
                    <Table.Td>{paciente.dataNascimento ? formatarDataExibicao(paciente.dataNascimento) : '—'}</Table.Td>
                    <Table.Td>{paciente.contato ?? '—'}</Table.Td>
                    <Table.Td>
                      <Badge color={paciente.anonimizado ? 'gray' : 'green'} variant="light">
                        {paciente.anonimizado ? 'Anonimizado' : 'Ativo'}
                      </Badge>
                    </Table.Td>
                    {(podeEditar || podeRemover || podeAnonimizar) && (
                      <Table.Td>
                        <Group gap={4} justify="flex-end">
                          {podeEditar && (
                            <Tooltip
                              label={
                                acoesDesabilitadas
                                  ? 'Cadastros anonimizados não podem ser editados'
                                  : 'Editar cadastro'
                              }
                            >
                              <ActionIcon
                                variant="subtle"
                                disabled={acoesDesabilitadas}
                                onClick={() => abrirEdicao(paciente)}
                              >
                                <IconEdit size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          {podeRemover && (
                            <Tooltip
                              label={
                                acoesDesabilitadas
                                  ? 'Cadastros anonimizados não podem ser removidos'
                                  : 'Remover cadastro'
                              }
                            >
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                disabled={acoesDesabilitadas}
                                onClick={() => setPacienteParaRemover(paciente)}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          {podeAnonimizar && (
                            <Tooltip
                              label={
                                acoesDesabilitadas
                                  ? 'Este cadastro já foi anonimizado'
                                  : 'Anonimizar dados pessoais (LGPD)'
                              }
                            >
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                disabled={acoesDesabilitadas}
                                onClick={() => abrirAnonimizacao(paciente)}
                              >
                                <IconShieldLock size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                    )}
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        {!isLoading && (resultado?.itens.length ?? 0) === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            {buscaDebounced
              ? 'Nenhum paciente encontrado para a busca informada.'
              : 'Digite um nome para localizar pacientes.'}
          </Text>
        )}
      </Card>

      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title="Novo paciente" centered>
        <form onSubmit={form.onSubmit(aoSubmeter)}>
          <Stack>
            <TextInput label="Nome completo" required {...form.getInputProps('nome')} />
            <TextInput
              label="CPF"
              placeholder="Opcional — somente números"
              {...form.getInputProps('documento')}
            />
            <DateInput
              label="Data de nascimento"
              placeholder="Opcional"
              valueFormat="DD/MM/YYYY"
              clearable
              maxDate={new Date()}
              {...form.getInputProps('dataNascimento')}
            />
            <TextInput
              label="Contato (telefone/e-mail)"
              placeholder="Opcional"
              {...form.getInputProps('contato')}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={criarPaciente.isPending}>
                Cadastrar
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={pacienteEmEdicao !== null}
        onClose={() => setPacienteEmEdicao(null)}
        title="Editar paciente"
        centered
      >
        <form onSubmit={formEdicao.onSubmit(aoSalvarEdicao)}>
          <Stack>
            <Text size="xs" c="dimmed">
              O CPF e a data de nascimento identificam o paciente de forma estável e não podem ser alterados —
              caso estejam incorretos, remova este cadastro e crie um novo, preservando a trilha de auditoria.
            </Text>
            <TextInput label="Nome completo" required {...formEdicao.getInputProps('nome')} />
            <TextInput
              label="Contato (telefone/e-mail)"
              placeholder="Opcional"
              {...formEdicao.getInputProps('contato')}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setPacienteEmEdicao(null)}>
                Cancelar
              </Button>
              <Button type="submit" loading={atualizarPaciente.isPending}>
                Salvar alterações
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {pacienteParaRemover && (
        <ConfirmarRemocaoCadastro
          aberto={pacienteParaRemover !== null}
          aoFechar={() => setPacienteParaRemover(null)}
          entidade="paciente"
          nomeRegistro={pacienteParaRemover.nome}
          filtroVinculos={{ pacienteId: pacienteParaRemover.id }}
          aoConfirmar={aoConfirmarRemocao}
          confirmando={removerPaciente.isPending}
        />
      )}
    </Stack>
  );
}

function formatarData(data: Date): string {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function formatarDataExibicao(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}
