import { Alert, Box, Button, Center, Paper, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { isAxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import { IconLogout, IconShieldLock } from '@tabler/icons-react';
import { useAlterarMinhaSenha } from '@/api/usuarios';
import { useAuth } from '@/auth/AuthContext';

const SENHA_FORTE_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

interface FormValues {
  senhaAtual: string;
  novaSenha: string;
  confirmarNovaSenha: string;
}

/**
 * Tela obrigatória de troca de senha — exibida no primeiro acesso após uma
 * senha provisória ser definida por um administrador (criação de conta ou
 * redefinição de senha). Enquanto usuario.precisaTrocarSenha for true, o
 * roteamento (RotaProtegida) força a exibição desta tela em vez do restante
 * do sistema, e o backend bloqueia independentemente qualquer outra rota
 * (TrocaSenhaObrigatoriaGuard) — defesa em profundidade.
 *
 * Reutiliza o endpoint /auth/alterar-senha (exige a senha atual) em vez de
 * trocar a senha sem confirmação: mesmo logo após o login, confirmar a senha
 * atual reduz o risco de um dispositivo/sessão comprometidos definirem uma
 * nova senha sem o conhecimento de quem realmente é o dono da conta.
 */
export function TrocarSenhaObrigatoriaPage() {
  const { usuario, sair, atualizarDadosDaSessao } = useAuth();
  const navigate = useNavigate();
  const alterarSenha = useAlterarMinhaSenha();

  const form = useForm<FormValues>({
    initialValues: { senhaAtual: '', novaSenha: '', confirmarNovaSenha: '' },
    validate: {
      senhaAtual: (valor) => (valor.length > 0 ? null : 'Informe a senha temporária recebida.'),
      novaSenha: (valor) =>
        valor.length >= 12 && SENHA_FORTE_REGEX.test(valor)
          ? null
          : 'A nova senha deve ter ao menos 12 caracteres, com maiúscula, minúscula, número e símbolo.',
      confirmarNovaSenha: (valor, valores) =>
        valor === valores.novaSenha ? null : 'As senhas não coincidem.',
    },
  });

  async function aoEnviar(valores: FormValues) {
    try {
      await alterarSenha.mutateAsync({ senhaAtual: valores.senhaAtual, novaSenha: valores.novaSenha });
      atualizarDadosDaSessao({ precisaTrocarSenha: false });
      notifications.show({
        color: 'green',
        title: 'Senha definida',
        message: 'Sua nova senha foi salva. Bem-vindo(a)!',
      });
      navigate('/', { replace: true });
    } catch (erro) {
      const mensagem = isAxiosError(erro)
        ? (erro.response?.data as { message?: string } | undefined)?.message
        : undefined;
      notifications.show({
        color: 'red',
        title: 'Não foi possível definir a nova senha',
        message: mensagem ?? 'Confira a senha temporária informada e tente novamente.',
      });
    }
  }

  function aoSair() {
    sair();
    navigate('/login', { replace: true });
  }

  return (
    <Center style={{ minHeight: '100vh', background: 'var(--mantine-color-body)' }}>
      <Stack w="100%" maw={440} gap="lg" p="lg">
        <Stack align="center" gap="xs">
          <Box
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(145deg, #b5650b 0%, #8a3d0d 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconShieldLock size={32} color="white" />
          </Box>
          <Title order={3} fw={700} ta="center">
            Defina uma nova senha
          </Title>
          <Text c="dimmed" size="sm" ta="center">
            {usuario ? `Olá, ${usuario.nome}. ` : ''}Antes de continuar, você precisa trocar sua senha
            provisória por uma senha pessoal.
          </Text>
        </Stack>

        <Alert color="orange" variant="light" title="Por que estou vendo isto?">
          Sua conta foi criada — ou teve a senha redefinida — por um administrador. Por segurança, essa senha
          provisória só pode ser usada para este primeiro acesso; nenhuma outra ação no sistema é liberada até
          que você defina uma senha própria.
        </Alert>

        <Paper withBorder shadow="sm" p="xl" radius="md">
          <form onSubmit={form.onSubmit(aoEnviar)}>
            <Stack gap="md">
              <PasswordInput
                label="Senha temporária"
                description="A senha provisória que você recebeu"
                autoComplete="current-password"
                required
                {...form.getInputProps('senhaAtual')}
              />
              <PasswordInput
                label="Nova senha"
                description="Mínimo 12 caracteres, com maiúscula, minúscula, número e símbolo."
                autoComplete="new-password"
                required
                {...form.getInputProps('novaSenha')}
              />
              <PasswordInput
                label="Confirmar nova senha"
                autoComplete="new-password"
                required
                {...form.getInputProps('confirmarNovaSenha')}
              />
              <Button type="submit" loading={alterarSenha.isPending} fullWidth size="md" mt="xs">
                Definir nova senha e continuar
              </Button>
            </Stack>
          </form>
        </Paper>

        <Button
          variant="subtle"
          color="gray"
          size="sm"
          leftSection={<IconLogout size={16} />}
          onClick={aoSair}
          style={{ alignSelf: 'center' }}
        >
          Sair sem trocar agora
        </Button>
      </Stack>
    </Center>
  );
}
