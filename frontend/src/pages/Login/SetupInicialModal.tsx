import { Button, Modal, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { useForm, isEmail, hasLength, matchesField } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { isAxiosError } from 'axios';
import { useSetupInicial } from '@/api/auth';

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  aoConcluir: () => void;
}

export function SetupInicialModal({ aberto, aoFechar, aoConcluir }: Props) {
  const setup = useSetupInicial();

  const form = useForm({
    initialValues: { nome: '', email: '', senha: '', confirmarSenha: '' },
    validate: {
      nome: hasLength({ min: 2 }, 'O nome deve ter ao menos 2 caracteres.'),
      email: isEmail('Informe um e-mail válido.'),
      senha: hasLength({ min: 8 }, 'A senha deve ter ao menos 8 caracteres.'),
      confirmarSenha: matchesField('senha', 'As senhas não coincidem.'),
    },
  });

  async function aoEnviar(valores: typeof form.values) {
    try {
      await setup.mutateAsync({ nome: valores.nome, email: valores.email, senha: valores.senha });
      notifications.show({ color: 'green', title: 'Configuração concluída', message: 'Administrador criado com sucesso! Faça login para continuar.' });
      aoConcluir();
    } catch (erro) {
      const mensagem = isAxiosError(erro)
        ? (erro.response?.data as { message?: string } | undefined)?.message
        : undefined;
      notifications.show({ color: 'red', title: 'Erro', message: mensagem ?? 'Não foi possível concluir a configuração.' });
    }
  }

  return (
    <Modal opened={aberto} onClose={aoFechar} title="Configuração inicial" centered>
      <form onSubmit={form.onSubmit(aoEnviar)}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Bem-vindo! Esta é a primeira instalação do sistema. Crie a conta de administrador para começar.
          </Text>
          <TextInput label="Nome completo" placeholder="Administrador" required {...form.getInputProps('nome')} />
          <TextInput label="E-mail" placeholder="admin@clinica.com" autoComplete="username" required {...form.getInputProps('email')} />
          <PasswordInput label="Senha" placeholder="Mínimo 8 caracteres" autoComplete="new-password" required {...form.getInputProps('senha')} />
          <PasswordInput label="Confirmar senha" placeholder="Repita a senha" autoComplete="new-password" required {...form.getInputProps('confirmarSenha')} />
          <Button type="submit" loading={setup.isPending} fullWidth>
            Criar administrador
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
