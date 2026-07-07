import { useEffect } from 'react';
import { Badge, Button, Card, Group, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { isAxiosError } from 'axios';
import { IconDeviceFloppy, IconKey } from '@tabler/icons-react';
import {
  useAlterarMinhaSenha,
  useAtualizarMeuPerfil,
  useMeuPerfil,
  type AlterarSenhaPayload,
} from '@/api/usuarios';
import { useAuth } from '@/auth/AuthContext';
import type { Papel } from '@/types/domain';

const SENHA_FORTE_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

interface FormDadosValues {
  nome: string;
}

interface FormSenhaValues extends AlterarSenhaPayload {
  confirmarNovaSenha: string;
}

/** Autoatendimento: cada pessoa consulta e mantém apenas o seu próprio cadastro de acesso. */
export function MeuPerfilPage() {
  const { usuario, atualizarDadosDaSessao } = useAuth();
  const { data: perfil, isLoading } = useMeuPerfil();
  const atualizarPerfil = useAtualizarMeuPerfil();
  const alterarSenha = useAlterarMinhaSenha();

  const formDados = useForm<FormDadosValues>({
    initialValues: { nome: '' },
    validate: {
      nome: (valor) => (valor.trim().length >= 3 ? null : 'Informe seu nome completo.'),
    },
  });

  const formSenha = useForm<FormSenhaValues>({
    initialValues: { senhaAtual: '', novaSenha: '', confirmarNovaSenha: '' },
    validate: {
      senhaAtual: (valor) => (valor.length > 0 ? null : 'Informe sua senha atual.'),
      novaSenha: (valor) =>
        valor.length >= 12 && SENHA_FORTE_REGEX.test(valor)
          ? null
          : 'A nova senha deve ter ao menos 12 caracteres, com maiúscula, minúscula, número e símbolo.',
      confirmarNovaSenha: (valor, valores) =>
        valor === valores.novaSenha ? null : 'As senhas não coincidem.',
    },
  });

  useEffect(() => {
    if (perfil) {
      formDados.setValues({ nome: perfil.nome });
      formDados.resetDirty({ nome: perfil.nome });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apenas sincroniza quando o cadastro chega do servidor
  }, [perfil]);

  async function aoSalvarDados(valores: FormDadosValues) {
    try {
      const atualizado = await atualizarPerfil.mutateAsync({ nome: valores.nome });
      atualizarDadosDaSessao({ nome: atualizado.nome });
      notifications.show({
        color: 'green',
        title: 'Cadastro atualizado',
        message: 'Seus dados foram salvos com sucesso.',
      });
    } catch (erro) {
      const mensagem = isAxiosError(erro)
        ? (erro.response?.data as { message?: string } | undefined)?.message
        : undefined;
      notifications.show({
        color: 'red',
        title: 'Não foi possível salvar seus dados',
        message: mensagem ?? 'Verifique as informações e tente novamente.',
      });
    }
  }

  async function aoAlterarSenha(valores: FormSenhaValues) {
    try {
      await alterarSenha.mutateAsync({ senhaAtual: valores.senhaAtual, novaSenha: valores.novaSenha });
      formSenha.reset();
      notifications.show({
        color: 'green',
        title: 'Senha alterada',
        message: 'Sua senha foi atualizada. As demais sessões ativas foram encerradas por segurança.',
      });
    } catch (erro) {
      const mensagem = isAxiosError(erro)
        ? (erro.response?.data as { message?: string } | undefined)?.message
        : undefined;
      notifications.show({
        color: 'red',
        title: 'Não foi possível alterar a senha',
        message: mensagem ?? 'Confira a senha atual informada e tente novamente.',
      });
    }
  }

  return (
    <Stack gap="lg">
      <Title order={2}>Meu cadastro</Title>
      <Text size="sm" c="dimmed">
        Aqui você consulta os dados da sua conta de acesso e pode atualizar seu nome ou trocar sua senha. O
        nível de acesso, o status da conta e o e-mail de login só podem ser alterados por um administrador.
      </Text>

      <Card withBorder padding="md">
        <Stack gap="md">
          <Group gap="xs">
            <Badge color={corDoPapel(usuario?.papel)} variant="light">
              {rotuloDoPapel(usuario?.papel)}
            </Badge>
            {perfil && (
              <Badge color={perfil.ativo ? 'green' : 'gray'} variant="light">
                {perfil.ativo ? 'Ativo' : 'Inativo'}
              </Badge>
            )}
          </Group>

          <TextInput label="E-mail de acesso" value={perfil?.email ?? usuario?.email ?? ''} disabled />
          <Text size="xs" c="dimmed">
            Último acesso: {formatarDataHora(perfil?.ultimoLoginEm)} · Conta criada em:{' '}
            {formatarDataHora(perfil?.criadoEm)}
          </Text>

          <form onSubmit={formDados.onSubmit(aoSalvarDados)}>
            <Stack>
              <TextInput
                label="Nome completo"
                required
                disabled={isLoading}
                {...formDados.getInputProps('nome')}
              />
              <Group justify="flex-end">
                <Button
                  type="submit"
                  leftSection={<IconDeviceFloppy size={16} />}
                  loading={atualizarPerfil.isPending}
                  disabled={!formDados.isDirty()}
                >
                  Salvar alterações
                </Button>
              </Group>
            </Stack>
          </form>
        </Stack>
      </Card>

      <Card withBorder padding="md">
        <Stack gap="md">
          <div>
            <Title order={4}>Alterar senha</Title>
            <Text size="xs" c="dimmed">
              Por segurança, é necessário informar a senha atual. Ao concluir, as demais sessões abertas com
              esta conta serão encerradas.
            </Text>
          </div>

          <form onSubmit={formSenha.onSubmit(aoAlterarSenha)}>
            <Stack>
              <PasswordInput label="Senha atual" required {...formSenha.getInputProps('senhaAtual')} />
              <PasswordInput
                label="Nova senha"
                description="Mínimo 12 caracteres, com maiúscula, minúscula, número e símbolo."
                required
                {...formSenha.getInputProps('novaSenha')}
              />
              <PasswordInput
                label="Confirmar nova senha"
                required
                {...formSenha.getInputProps('confirmarNovaSenha')}
              />
              <Group justify="flex-end">
                <Button
                  type="submit"
                  color="orange"
                  leftSection={<IconKey size={16} />}
                  loading={alterarSenha.isPending}
                >
                  Alterar senha
                </Button>
              </Group>
            </Stack>
          </form>
        </Stack>
      </Card>
    </Stack>
  );
}

function rotuloDoPapel(papel: Papel | undefined): string {
  switch (papel) {
    case 'ADMIN':
      return 'Administrador';
    case 'GESTOR':
      return 'Gestor';
    case 'TECNICO':
      return 'Técnico';
    default:
      return '—';
  }
}

function corDoPapel(papel: Papel | undefined): string {
  switch (papel) {
    case 'ADMIN':
      return 'red';
    case 'GESTOR':
      return 'blue';
    case 'TECNICO':
      return 'teal';
    default:
      return 'gray';
  }
}

function formatarDataHora(data: string | null | undefined): string {
  if (!data) return 'nunca acessou';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(data));
}
