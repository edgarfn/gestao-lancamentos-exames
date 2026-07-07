import { useRef, useState } from 'react';
import { useForm } from '@mantine/form';
import {
  Anchor,
  Box,
  Button,
  Center,
  Group,
  Image,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useLocation, useNavigate } from 'react-router-dom';
import { isEmail, hasLength } from '@mantine/form';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useAuth } from '@/auth/AuthContext';
import { isAxiosError } from 'axios';
import { IconFlask2, IconLock } from '@tabler/icons-react';
import { useConfiguracaoPublica } from '@/api/configuracoes';
import { useNecessitaConfiguracao } from '@/api/auth';
import { EsqueciSenhaModal } from './EsqueciSenhaModal';
import { SetupInicialModal } from './SetupInicialModal';

interface LocationState {
  de?: { pathname: string };
}

export function LoginPage() {
  const { entrar } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [enviando, setEnviando] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const { data: branding } = useConfiguracaoPublica();
  const [esqueciAberto, setEsqueciAberto] = useState(false);
  const [setupAberto, setSetupAberto] = useState(false);
  const { data: precisaSetup } = useNecessitaConfiguracao();

  const form = useForm({
    initialValues: { email: '', senha: '' },
    validate: {
      email: isEmail('Informe um e-mail válido.'),
      senha: hasLength({ min: 8 }, 'A senha deve ter ao menos 8 caracteres.'),
    },
  });

  async function aoEnviar(valores: typeof form.values) {
    if (!turnstileToken) {
      notifications.show({
        color: 'red',
        title: 'Verificação de segurança pendente',
        message: 'Aguarde a conclusão da verificação anti-bot (ou recarregue a página) antes de entrar.',
      });
      return;
    }

    setEnviando(true);
    try {
      await entrar(valores.email, valores.senha, turnstileToken);
      const destino = (location.state as LocationState | null)?.de?.pathname ?? '/';
      navigate(destino, { replace: true });
    } catch (erro) {
      const mensagem = isAxiosError(erro)
        ? (erro.response?.data as { message?: string } | undefined)?.message
        : undefined;
      notifications.show({
        color: 'red',
        title: 'Falha no login',
        message: mensagem ?? 'Não foi possível entrar. Verifique suas credenciais.',
      });
      // Token Turnstile é de uso único — regenera após cada tentativa
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setEnviando(false);
    }
  }

  const nomeSistema = branding?.nomeClinica ?? 'Sistema de Exames';

  return (
    <Box style={{ minHeight: '100vh', display: 'flex' }}>
      {/* Painel esquerdo — branding (visível apenas ≥ sm) */}
      <Box
        visibleFrom="sm"
        style={{
          flex: '0 0 42%',
          background: 'linear-gradient(145deg, #1a7f64 0%, #0d5e8a 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2.5rem',
        }}
      >
        <Stack align="center" gap="xl">
          {branding?.logoBase64 ? (
            <Image
              src={branding.logoBase64}
              h={90}
              w="auto"
              fit="contain"
              alt={nomeSistema}
              style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))' }}
            />
          ) : (
            <Box
              style={{
                width: 88,
                height: 88,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 0 12px rgba(255,255,255,0.06)',
              }}
            >
              <IconFlask2 size={46} color="white" />
            </Box>
          )}

          <Stack align="center" gap={6}>
            <Title order={2} c="white" ta="center" style={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
              {nomeSistema}
            </Title>
            <Text c="rgba(255,255,255,0.7)" ta="center" size="sm" maw={260} lh={1.5}>
              Sistema seguro para gestão de lançamentos de exames clínicos
            </Text>
          </Stack>

          <Group gap={6} mt="md">
            <IconLock size={13} color="rgba(255,255,255,0.45)" />
            <Text c="rgba(255,255,255,0.45)" size="xs">
              Conexão segura · Ações auditadas
            </Text>
          </Group>
        </Stack>
      </Box>

      {/* Painel direito — formulário */}
      <Box
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          background: 'var(--mantine-color-body)',
        }}
      >
        <Stack w="100%" maw={400} gap="lg">
          {/* Banner compacto para mobile */}
          <Box
            hiddenFrom="sm"
            style={{
              background: 'linear-gradient(145deg, #1a7f64 0%, #0d5e8a 100%)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
            }}
          >
            <Stack align="center" gap="xs">
              {branding?.logoBase64 ? (
                <Image src={branding.logoBase64} h={52} w="auto" fit="contain" alt={nomeSistema} />
              ) : (
                <IconFlask2 size={36} color="white" />
              )}
              <Title order={4} c="white" ta="center">
                {nomeSistema}
              </Title>
            </Stack>
          </Box>

          <Stack gap={4}>
            <Title order={3} fw={700}>
              Acesso ao sistema
            </Title>
            <Text c="dimmed" size="sm">
              Informe suas credenciais para continuar
            </Text>
          </Stack>

          <Paper withBorder shadow="sm" p="xl" radius="md">
            <form onSubmit={form.onSubmit(aoEnviar)}>
              <Stack gap="md">
                <TextInput
                  label="E-mail"
                  placeholder="seu.email@exemplo.com"
                  autoComplete="username"
                  required
                  {...form.getInputProps('email')}
                />
                <PasswordInput
                  label="Senha"
                  placeholder="Sua senha"
                  autoComplete="current-password"
                  required
                  {...form.getInputProps('senha')}
                />
                <Center>
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                    onSuccess={setTurnstileToken}
                    onExpire={() => setTurnstileToken(null)}
                    onError={() => setTurnstileToken(null)}
                  />
                </Center>
                <Button
                  type="submit"
                  loading={enviando}
                  disabled={!turnstileToken}
                  fullWidth
                  size="md"
                  mt="xs"
                >
                  Entrar
                </Button>
                <Center>
                  <Anchor size="sm" onClick={() => setEsqueciAberto(true)} style={{ cursor: 'pointer' }}>
                    Esqueci minha senha
                  </Anchor>
                </Center>
                {precisaSetup && (
                  <Center>
                    <Anchor size="sm" c="teal" onClick={() => setSetupAberto(true)} style={{ cursor: 'pointer' }}>
                      Primeira instalação? Configurar administrador
                    </Anchor>
                  </Center>
                )}
              </Stack>
            </form>
          </Paper>

          <Text size="xs" c="dimmed" ta="center" maw={340} style={{ alignSelf: 'center' }}>
            Acesso restrito a usuários autorizados. Todas as ações são registradas para fins de auditoria.
          </Text>
        </Stack>
      </Box>

      <EsqueciSenhaModal aberto={esqueciAberto} aoFechar={() => setEsqueciAberto(false)} />
      <SetupInicialModal
        aberto={setupAberto}
        aoFechar={() => setSetupAberto(false)}
        aoConcluir={() => setSetupAberto(false)}
      />
    </Box>
  );
}
