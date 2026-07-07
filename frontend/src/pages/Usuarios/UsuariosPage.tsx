import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  Group,
  Modal,
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
import { IconAlertTriangle, IconCheck, IconCopy, IconEdit, IconKey, IconPlus } from '@tabler/icons-react';
import { useAtualizarUsuario, useCriarUsuario, useRedefinirSenhaUsuario, useUsuarios } from '@/api/usuarios';
import type { Papel, Usuario } from '@/types/domain';
import { useAuth } from '@/auth/AuthContext';

const OPCOES_PAPEL = [
  { value: 'ADMIN', label: 'Administrador — gestão completa do sistema' },
  { value: 'GESTOR', label: 'Gestor — acesso completo exceto auditoria' },
  { value: 'TECNICO', label: 'Técnico — registra seus próprios lançamentos' },
];

interface FormValues {
  nome: string;
  email: string;
  papel: Papel | null;
  senha: string;
}

interface FormEdicaoValues {
  nome: string;
  papel: Papel | null;
  ativo: boolean;
  registroProfissional: string;
}

export function UsuariosPage() {
  const [modalAberto, setModalAberto] = useState(false);
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<Usuario | null>(null);
  const [usuarioParaRedefinir, setUsuarioParaRedefinir] = useState<Usuario | null>(null);
  const [senhaTemporaria, setSenhaTemporaria] = useState<string | null>(null);

  const { usuario: usuarioLogado, possuiPapel } = useAuth();
  const opcoesPapel = OPCOES_PAPEL.filter((op) => op.value !== 'ADMIN' || possuiPapel('ADMIN'));
  const { data: usuarios, isLoading } = useUsuarios();
  const criarUsuario = useCriarUsuario();
  const atualizarUsuario = useAtualizarUsuario();
  const redefinirSenha = useRedefinirSenhaUsuario();

  const form = useForm<FormValues>({
    initialValues: { nome: '', email: '', papel: null, senha: '' },
    validate: {
      nome: (valor) => (valor.trim().length >= 3 ? null : 'Informe o nome completo do usuário.'),
      email: (valor) => (/^\S+@\S+\.\S+$/.test(valor) ? null : 'Informe um e-mail válido.'),
      papel: (valor) => (valor ? null : 'Selecione o nível de acesso do usuário.'),
      senha: (valor) =>
        valor.length >= 12 && /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(valor)
          ? null
          : 'A senha deve ter ao menos 12 caracteres, com maiúscula, minúscula, número e símbolo.',
    },
  });

  const formEdicao = useForm<FormEdicaoValues>({
    initialValues: { nome: '', papel: null, ativo: true, registroProfissional: '' },
    validate: {
      nome: (valor) => (valor.trim().length >= 3 ? null : 'Informe o nome completo do usuário.'),
      papel: (valor) => (valor ? null : 'Selecione o nível de acesso do usuário.'),
    },
  });

  async function aoSubmeter(valores: FormValues) {
    try {
      await criarUsuario.mutateAsync({
        nome: valores.nome,
        email: valores.email,
        papel: valores.papel!,
        senha: valores.senha,
      });
      notifications.show({
        color: 'green',
        title: 'Usuário cadastrado',
        message: 'A conta foi criada e já pode ser utilizada para acesso ao sistema.',
      });
      form.reset();
      setModalAberto(false);
    } catch (erro) {
      const mensagem = isAxiosError(erro)
        ? (erro.response?.data as { message?: string } | undefined)?.message
        : undefined;
      notifications.show({
        color: 'red',
        title: 'Não foi possível cadastrar o usuário',
        message: mensagem ?? 'Verifique os dados informados e tente novamente.',
      });
    }
  }

  function abrirEdicao(usuario: Usuario) {
    setUsuarioEmEdicao(usuario);
    formEdicao.setValues({
      nome: usuario.nome,
      papel: usuario.papel,
      ativo: usuario.ativo,
      registroProfissional: usuario.tecnico?.registroProfissional ?? '',
    });
  }

  async function aoSalvarEdicao(valores: FormEdicaoValues) {
    if (!usuarioEmEdicao) return;
    try {
      await atualizarUsuario.mutateAsync({
        id: usuarioEmEdicao.id,
        payload: {
          nome: valores.nome,
          papel: valores.papel!,
          ativo: valores.ativo,
          ...(valores.papel === 'TECNICO' ? { registroProfissional: valores.registroProfissional } : {}),
        },
      });
      notifications.show({
        color: 'green',
        title: 'Usuário atualizado',
        message: 'As alterações foram salvas com sucesso.',
      });
      setUsuarioEmEdicao(null);
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

  async function aoConfirmarRedefinicao() {
    if (!usuarioParaRedefinir) return;
    try {
      const resultado = await redefinirSenha.mutateAsync(usuarioParaRedefinir.id);
      setSenhaTemporaria(resultado.senhaTemporaria);
      setUsuarioParaRedefinir(null);
    } catch (erro) {
      const mensagem = isAxiosError(erro)
        ? (erro.response?.data as { message?: string } | undefined)?.message
        : undefined;
      notifications.show({
        color: 'red',
        title: 'Não foi possível redefinir a senha',
        message: mensagem ?? 'Tente novamente em instantes.',
      });
    }
  }

  const editandoSiPropio = usuarioEmEdicao?.id === usuarioLogado?.id;

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Usuários do sistema</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModalAberto(true)}>
          Novo usuário
        </Button>
      </Group>

      <Card withBorder padding="md">
        <Text size="xs" c="dimmed" mb="md">
          Esta área controla quem pode acessar o sistema e com qual nível de permissão. É visível para
          administradores e gestores. Conceda o papel de <strong>Administrador</strong> com cautela — ele
          permite gerenciar todas as contas, inclusive a própria.
        </Text>

        <Table.ScrollContainer minWidth={600}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nome</Table.Th>
                <Table.Th>E-mail</Table.Th>
                <Table.Th>Nível de acesso</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Último acesso</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(usuarios ?? []).map((usuario) => (
                <Table.Tr key={usuario.id}>
                  <Table.Td>
                    {usuario.nome}
                    {usuario.id === usuarioLogado?.id && (
                      <Badge ml="xs" size="xs" variant="light">
                        Você
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>{usuario.email}</Table.Td>
                  <Table.Td>
                    <Badge color={corDoPapel(usuario.papel)} variant="light">
                      {rotuloDoPapel(usuario.papel)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={usuario.ativo ? 'green' : 'gray'} variant="light">
                      {usuario.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {formatarDataHora(usuario.ultimoLoginEm)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end">
                      <Tooltip label="Editar cadastro">
                        <ActionIcon variant="subtle" onClick={() => abrirEdicao(usuario)}>
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Gerar nova senha temporária">
                        <ActionIcon
                          variant="subtle"
                          color="orange"
                          onClick={() => setUsuarioParaRedefinir(usuario)}
                        >
                          <IconKey size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        {!isLoading && (usuarios?.length ?? 0) === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            Nenhum usuário cadastrado.
          </Text>
        )}
      </Card>

      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title="Novo usuário" centered>
        <form onSubmit={form.onSubmit(aoSubmeter)}>
          <Stack>
            <Text size="xs" c="dimmed">
              A pessoa receberá esta senha para o primeiro acesso. Recomenda-se orientá-la a alterá-la assim
              que possível.
            </Text>
            <TextInput label="Nome completo" required {...form.getInputProps('nome')} />
            <TextInput label="E-mail de acesso" required {...form.getInputProps('email')} />
            <Select
              label="Nível de acesso"
              placeholder="Selecione"
              required
              data={opcoesPapel}
              {...form.getInputProps('papel')}
            />
            <TextInput
              label="Senha provisória"
              description="Mínimo 12 caracteres, com maiúscula, minúscula, número e símbolo."
              required
              {...form.getInputProps('senha')}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={criarUsuario.isPending}>
                Cadastrar
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={usuarioEmEdicao !== null}
        onClose={() => setUsuarioEmEdicao(null)}
        title="Editar usuário"
        centered
      >
        <form onSubmit={formEdicao.onSubmit(aoSalvarEdicao)}>
          <Stack>
            <Text size="xs" c="dimmed">
              O e-mail é o identificador de acesso e não pode ser alterado — caso esteja incorreto, crie um
              novo cadastro e desative este, preservando a trilha de auditoria.
            </Text>
            {editandoSiPropio && (
              <Alert icon={<IconAlertTriangle size={18} />} color="yellow" variant="light">
                Você está editando a sua própria conta. Alterar o nível de acesso ou desativar este cadastro
                pode resultar na perda imediata do seu próprio acesso ao sistema.
              </Alert>
            )}
            <TextInput label="Nome completo" required {...formEdicao.getInputProps('nome')} />
            <Select
              label="Nível de acesso"
              placeholder="Selecione"
              required
              data={opcoesPapel}
              {...formEdicao.getInputProps('papel')}
            />
            {formEdicao.values.papel === 'TECNICO' && (
              <TextInput
                label="Registro profissional"
                placeholder="Ex.: CRBio 12345/01-D"
                description="Número do registro no conselho de classe (opcional)."
                {...formEdicao.getInputProps('registroProfissional')}
              />
            )}
            <Switch
              label="Conta ativa"
              description="Contas inativas perdem o acesso imediatamente — todas as sessões em uso são revogadas."
              checked={formEdicao.values.ativo}
              onChange={(evento) => formEdicao.setFieldValue('ativo', evento.currentTarget.checked)}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setUsuarioEmEdicao(null)}>
                Cancelar
              </Button>
              <Button type="submit" loading={atualizarUsuario.isPending}>
                Salvar alterações
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={usuarioParaRedefinir !== null}
        onClose={() => setUsuarioParaRedefinir(null)}
        title="Gerar nova senha temporária"
        centered
      >
        {usuarioParaRedefinir && (
          <Stack gap="md">
            <Text size="sm">
              Confirma a geração de uma nova senha temporária para{' '}
              <strong>"{usuarioParaRedefinir.nome}"</strong>?
            </Text>
            <Alert icon={<IconAlertTriangle size={18} />} color="yellow" variant="light">
              A senha atual deixará de funcionar imediatamente e todas as sessões ativas desta conta serão
              encerradas. A nova senha será exibida apenas uma vez — anote-a ou copie-a para repassar com
              segurança à pessoa responsável.
            </Alert>
            <Group justify="flex-end" mt="xs">
              <Button variant="default" onClick={() => setUsuarioParaRedefinir(null)}>
                Cancelar
              </Button>
              <Button color="orange" loading={redefinirSenha.isPending} onClick={aoConfirmarRedefinicao}>
                Gerar nova senha
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={senhaTemporaria !== null}
        onClose={() => setSenhaTemporaria(null)}
        title="Senha temporária gerada"
        centered
        closeOnClickOutside={false}
      >
        <Stack gap="md">
          <Alert icon={<IconAlertTriangle size={18} />} color="red" variant="light">
            Esta senha é exibida apenas uma vez e não poderá ser recuperada depois de fechar esta janela.
            Copie-a e repasse-a com segurança à pessoa responsável.
          </Alert>
          <Group gap="xs" justify="center">
            <Text size="lg" fw={700} ff="monospace">
              {senhaTemporaria}
            </Text>
            <CopyButton value={senhaTemporaria ?? ''}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copiado!' : 'Copiar senha'}>
                  <ActionIcon variant="light" color={copied ? 'green' : 'blue'} onClick={copy}>
                    {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
          <Group justify="flex-end">
            <Button onClick={() => setSenhaTemporaria(null)}>Concluído, já anotei a senha</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function rotuloDoPapel(papel: Papel): string {
  switch (papel) {
    case 'ADMIN':
      return 'Administrador';
    case 'GESTOR':
      return 'Gestor';
    case 'TECNICO':
      return 'Técnico';
  }
}

function corDoPapel(papel: Papel): string {
  switch (papel) {
    case 'ADMIN':
      return 'red';
    case 'GESTOR':
      return 'blue';
    case 'TECNICO':
      return 'teal';
  }
}

function formatarDataHora(data: string | null): string {
  if (!data) return 'Nunca acessou';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(data));
}
