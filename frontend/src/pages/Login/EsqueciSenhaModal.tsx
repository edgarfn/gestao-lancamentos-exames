import { useState } from 'react';
import { Button, Modal, Stack, Text, TextInput } from '@mantine/core';
import { useForm, isEmail } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { isAxiosError } from 'axios';
import { useSolicitarRecuperacao } from '@/api/auth';

interface Props {
  aberto: boolean;
  aoFechar: () => void;
}

export function EsqueciSenhaModal({ aberto, aoFechar }: Props) {
  const [enviado, setEnviado] = useState(false);
  const solicitar = useSolicitarRecuperacao();

  const form = useForm({
    initialValues: { email: '' },
    validate: { email: isEmail('Informe um e-mail válido.') },
  });

  async function aoEnviar(valores: typeof form.values) {
    try {
      await solicitar.mutateAsync(valores.email);
      setEnviado(true);
    } catch (erro) {
      const mensagem = isAxiosError(erro)
        ? (erro.response?.data as { message?: string } | undefined)?.message
        : undefined;
      notifications.show({ color: 'red', title: 'Erro', message: mensagem ?? 'Não foi possível processar sua solicitação.' });
    }
  }

  function aoFecharELimpar() {
    setEnviado(false);
    form.reset();
    aoFechar();
  }

  return (
    <Modal opened={aberto} onClose={aoFecharELimpar} title="Recuperar senha" centered>
      {enviado ? (
        <Stack gap="md">
          <Text>
            Se o e-mail informado estiver cadastrado no sistema, você receberá as instruções para redefinir sua senha em
            breve.
          </Text>
          <Text size="sm" c="dimmed">
            Não recebeu? Verifique a pasta de spam ou entre em contato com o administrador do sistema.
          </Text>
          <Button onClick={aoFecharELimpar}>Fechar</Button>
        </Stack>
      ) : (
        <form onSubmit={form.onSubmit(aoEnviar)}>
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Informe seu e-mail cadastrado e, se ele existir no sistema, enviaremos um link para redefinir sua senha.
            </Text>
            <TextInput
              label="E-mail"
              placeholder="seu.email@exemplo.com"
              autoComplete="email"
              required
              {...form.getInputProps('email')}
            />
            <Button type="submit" loading={solicitar.isPending} fullWidth>
              Enviar instruções
            </Button>
          </Stack>
        </form>
      )}
    </Modal>
  );
}
