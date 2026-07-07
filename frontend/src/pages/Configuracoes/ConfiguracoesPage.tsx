import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  FileInput,
  Group,
  Image,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { isAxiosError } from 'axios';
import { IconBuilding, IconPhoto, IconMessageCircle, IconMoon } from '@tabler/icons-react';
import {
  useAtualizarConfiguracoes,
  useConfiguracoes,
  useLogoUrl,
  useUploadLogo,
} from '@/api/configuracoes';

interface FormIdentidade {
  nomeClinica: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  emailContato: string;
}

interface FormMensagem {
  mensagemBemVindo: string;
}

/**
 * Configurações da clínica — restrito ao ADMIN.
 * Permite definir nome, logotipo, dados de contato e mensagem de boas-vindas
 * que aparece no cabeçalho e no painel para todos os usuários.
 */
export function ConfiguracoesPage() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const { data: config, isLoading } = useConfiguracoes();
  const { data: logoUrl } = useLogoUrl(config?.temLogo ?? false);
  const atualizar = useAtualizarConfiguracoes();
  const uploadLogo = useUploadLogo();

  const [arquivoLogo, setArquivoLogo] = useState<File | null>(null);
  const inicializadoRef = useRef(false);

  const formIdentidade = useForm<FormIdentidade>({
    initialValues: { nomeClinica: '', cnpj: '', endereco: '', telefone: '', emailContato: '' },
    validate: {
      emailContato: (v) => (!v || /^\S+@\S+\.\S+$/.test(v) ? null : 'Informe um e-mail válido.'),
    },
  });

  const formMensagem = useForm<FormMensagem>({
    initialValues: { mensagemBemVindo: '' },
    validate: {
      mensagemBemVindo: (v) => (v.length <= 300 ? null : 'Máximo de 300 caracteres.'),
    },
  });

  useEffect(() => {
    if (config && !inicializadoRef.current) {
      inicializadoRef.current = true;
      formIdentidade.setValues({
        nomeClinica: config.nomeClinica ?? '',
        cnpj: config.cnpj ?? '',
        endereco: config.endereco ?? '',
        telefone: config.telefone ?? '',
        emailContato: config.emailContato ?? '',
      });
      formMensagem.setValues({ mensagemBemVindo: config.mensagemBemVindo ?? '' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  async function aoSalvarIdentidade(valores: FormIdentidade) {
    try {
      await atualizar.mutateAsync({
        nomeClinica: valores.nomeClinica || undefined,
        cnpj: valores.cnpj || undefined,
        endereco: valores.endereco || undefined,
        telefone: valores.telefone || undefined,
        emailContato: valores.emailContato || undefined,
      });
      notifications.show({ color: 'green', title: 'Configurações salvas', message: 'As informações da clínica foram atualizadas.' });
    } catch (erro) {
      const mensagem = isAxiosError(erro)
        ? (erro.response?.data as { message?: string } | undefined)?.message
        : undefined;
      notifications.show({ color: 'red', title: 'Erro ao salvar', message: mensagem ?? 'Tente novamente.' });
    }
  }

  async function aoSalvarMensagem(valores: FormMensagem) {
    try {
      await atualizar.mutateAsync({ mensagemBemVindo: valores.mensagemBemVindo || undefined });
      notifications.show({ color: 'green', title: 'Mensagem salva', message: 'A mensagem de boas-vindas foi atualizada.' });
    } catch (erro) {
      const mensagem = isAxiosError(erro)
        ? (erro.response?.data as { message?: string } | undefined)?.message
        : undefined;
      notifications.show({ color: 'red', title: 'Erro ao salvar', message: mensagem ?? 'Tente novamente.' });
    }
  }

  async function aoEnviarLogo() {
    if (!arquivoLogo) return;
    try {
      await uploadLogo.mutateAsync(arquivoLogo);
      setArquivoLogo(null);
      notifications.show({ color: 'green', title: 'Logotipo atualizado', message: 'O logotipo da clínica foi salvo com sucesso.' });
    } catch (erro) {
      const mensagem = isAxiosError(erro)
        ? (erro.response?.data as { message?: string } | undefined)?.message
        : undefined;
      notifications.show({ color: 'red', title: 'Erro ao enviar logotipo', message: mensagem ?? 'Verifique o arquivo e tente novamente.' });
    }
  }

  if (isLoading) return null;

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Configurações do sistema</Title>
      </Group>

      <Text size="sm" c="dimmed">
        Personalize a identidade da clínica no sistema. As informações aqui cadastradas são exibidas
        no cabeçalho da aplicação e nos relatórios exportados.
      </Text>

      {/* Identidade da clínica */}
      <Card withBorder padding="md">
        <Group mb="md" gap="xs">
          <IconBuilding size={20} />
          <Text fw={600}>Identidade da clínica</Text>
        </Group>
        <form onSubmit={formIdentidade.onSubmit(aoSalvarIdentidade)}>
          <Stack gap="sm">
            <TextInput
              label="Nome da clínica"
              placeholder="Ex.: Clínica São Lucas"
              maxLength={150}
              {...formIdentidade.getInputProps('nomeClinica')}
            />
            <TextInput
              label="CNPJ"
              placeholder="00.000.000/0000-00"
              maxLength={18}
              {...formIdentidade.getInputProps('cnpj')}
            />
            <Textarea
              label="Endereço"
              placeholder="Rua, número, bairro, cidade — UF"
              maxLength={300}
              rows={2}
              {...formIdentidade.getInputProps('endereco')}
            />
            <Group grow>
              <TextInput
                label="Telefone"
                placeholder="(00) 00000-0000"
                maxLength={20}
                {...formIdentidade.getInputProps('telefone')}
              />
              <TextInput
                label="E-mail de contato"
                placeholder="contato@clinica.com.br"
                {...formIdentidade.getInputProps('emailContato')}
              />
            </Group>
            <Group justify="flex-end" mt="xs">
              <Button type="submit" loading={atualizar.isPending}>
                Salvar alterações
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>

      {/* Logotipo */}
      <Card withBorder padding="md">
        <Group mb="md" gap="xs">
          <IconPhoto size={20} />
          <Text fw={600}>Logotipo</Text>
        </Group>
        <Stack gap="sm">
          {logoUrl ? (
            <Box>
              <Text size="xs" c="dimmed" mb="xs">Logotipo atual:</Text>
              <Image src={logoUrl} h={80} w="auto" fit="contain" radius="sm" />
            </Box>
          ) : (
            <Text size="sm" c="dimmed">Nenhum logotipo cadastrado. O nome da clínica será exibido no cabeçalho.</Text>
          )}
          <FileInput
            label="Novo logotipo"
            description="PNG, JPG, SVG ou WebP — máximo 2 MB."
            placeholder="Selecione um arquivo"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            value={arquivoLogo}
            onChange={setArquivoLogo}
            clearable
          />
          <Group justify="flex-end">
            <Button
              onClick={aoEnviarLogo}
              disabled={!arquivoLogo}
              loading={uploadLogo.isPending}
            >
              Enviar logotipo
            </Button>
          </Group>
        </Stack>
      </Card>

      {/* Aparência */}
      <Card withBorder padding="md">
        <Group mb="md" gap="xs">
          <IconMoon size={20} />
          <Text fw={600}>Aparência</Text>
        </Group>
        <Group justify="space-between" align="flex-start">
          <Stack gap={4} style={{ flex: 1 }}>
            <Text size="sm" fw={500}>Modo escuro</Text>
            <Text size="xs" c="dimmed">
              Ativa o tema escuro em todo o sistema. A preferência é salva neste navegador.
            </Text>
          </Stack>
          <Switch
            checked={colorScheme === 'dark'}
            onChange={() => toggleColorScheme()}
            size="md"
            aria-label="Alternar modo escuro"
          />
        </Group>
      </Card>

      {/* Mensagem de boas-vindas */}
      <Card withBorder padding="md">
        <Group mb="md" gap="xs">
          <IconMessageCircle size={20} />
          <Text fw={600}>Mensagem de boas-vindas</Text>
        </Group>
        <form onSubmit={formMensagem.onSubmit(aoSalvarMensagem)}>
          <Stack gap="sm">
            <Textarea
              label="Mensagem"
              description="Exibida no Painel para todos os usuários autenticados. Máximo de 300 caracteres."
              placeholder="Bem-vindo ao sistema de gestão de exames da Clínica São Lucas."
              maxLength={300}
              rows={3}
              {...formMensagem.getInputProps('mensagemBemVindo')}
            />
            <Text size="xs" c="dimmed" ta="right">
              {formMensagem.values.mensagemBemVindo.length}/300
            </Text>
            <Group justify="flex-end">
              <Button type="submit" loading={atualizar.isPending}>
                Salvar mensagem
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}
