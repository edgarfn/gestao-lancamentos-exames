import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, Center, Paper, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { useForm, hasLength, matchesField } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { isAxiosError } from 'axios';
import { IconFlask2 } from '@tabler/icons-react';
import { useRedefinirSenha } from '@/api/auth';

export function RedefinirSenhaPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const redefinir = useRedefinirSenha();

  useEffect(() => {
    if (!token) {
      notifications.show({ color: 'red', title: 'Link inválido', message: 'O link de recuperação de senha é inválido ou está incompleto.' });
      navigate('/login', { replace: true });
    }
  }, [token, navigate]);

  const form = useForm({
    initialValues: { novaSenha: '', confirmarSenha: '' },
    validate: {
      novaSenha: hasLength({ min: 8 }, 'A senha deve ter ao menos 8 caracteres.'),
      confirmarSenha: matchesField('novaSenha', 'As senhas não coincidem.'),
    },
  });

  async function aoEnviar(valores: typeof form.values) {
    try {
      await redefinir.mutateAsync({ token, novaSenha: valores.novaSenha });
      notifications.show({ color: 'green', title: 'Senha redefinida', message: 'Sua senha foi redefinida com sucesso. Faça login com a nova senha.' });
      navigate('/login', { replace: true });
    } catch (erro) {
      const mensagem = isAxiosError(erro)
        ? (erro.response?.data as { message?: string } | undefined)?.message
        : undefined;
      notifications.show({ color: 'red', title: 'Erro', message: mensagem ?? 'Não foi possível redefinir a senha. O link pode ter expirado.' });
    }
  }

  return (
    <Center style={{ minHeight: '100vh', background: 'var(--mantine-color-body)' }}>
      <Stack w="100%" maw={400} gap="lg" p="lg">
        <Stack align="center" gap="xs">
          <Box
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(145deg, #1a7f64 0%, #0d5e8a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconFlask2 size={32} color="white" />
          </Box>
          <Title order={3} fw={700}>
            Redefinir senha
          </Title>
          <Text c="dimmed" size="sm" ta="center">
            Crie uma nova senha para sua conta
          </Text>
        </Stack>

        <Paper withBorder shadow="sm" p="xl" radius="md">
          <form onSubmit={form.onSubmit(aoEnviar)}>
            <Stack gap="md">
              <PasswordInput
                label="Nova senha"
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                required
                {...form.getInputProps('novaSenha')}
              />
              <PasswordInput
                label="Confirmar nova senha"
                placeholder="Repita a nova senha"
                autoComplete="new-password"
                required
                {...form.getInputProps('confirmarSenha')}
              />
              <Button type="submit" loading={redefinir.isPending} fullWidth size="md" mt="xs">
                Redefinir senha
              </Button>
            </Stack>
          </form>
        </Paper>

        <Button variant="subtle" size="sm" onClick={() => navigate('/login')} style={{ alignSelf: 'center' }}>
          Voltar ao login
        </Button>
      </Stack>
    </Center>
  );
}
