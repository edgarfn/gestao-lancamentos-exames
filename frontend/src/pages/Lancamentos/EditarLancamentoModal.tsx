import { Alert, Button, Group, Modal, NumberInput, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { isAxiosError } from 'axios';
import { IconInfoCircle } from '@tabler/icons-react';
import { useAtualizarLancamento } from '@/api/lancamentos';
import type { Lancamento } from '@/types/domain';

interface EditarLancamentoModalProps {
  lancamento: Lancamento | null;
  aoFechar: () => void;
}

interface FormValues {
  data: Date | null;
  quantidade: number;
  valor: string;
  observacoes: string;
}

export function EditarLancamentoModal({ lancamento, aoFechar }: EditarLancamentoModalProps) {
  const atualizarLancamento = useAtualizarLancamento();

  const form = useForm<FormValues>({
    initialValues: {
      data: lancamento ? new Date(`${lancamento.data.slice(0, 10)}T00:00:00`) : null,
      quantidade: lancamento?.quantidade ?? 1,
      valor: lancamento?.valor ?? '',
      observacoes: lancamento?.observacoes ?? '',
    },
    validate: {
      data: (valor) => (valor ? null : 'Informe a data do exame.'),
      quantidade: (valor) => (valor > 0 ? null : 'Quantidade deve ser maior que zero.'),
      valor: (valor) => (/^\d+([.,]\d{1,2})?$/.test(valor) ? null : 'Informe um valor válido (ex.: 45.00).'),
    },
  });

  async function aoSubmeter(valores: FormValues) {
    if (!lancamento) return;
    try {
      await atualizarLancamento.mutateAsync({
        id: lancamento.id,
        payload: {
          data: formatarData(valores.data!),
          quantidade: valores.quantidade,
          valor: valores.valor.replace(',', '.'),
          observacoes: valores.observacoes || undefined,
        },
      });
      notifications.show({
        color: 'green',
        title: 'Lançamento atualizado',
        message: 'As alterações foram salvas com sucesso.',
      });
      fechar();
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

  function fechar() {
    form.reset();
    aoFechar();
  }

  return (
    <Modal
      opened={lancamento !== null}
      onClose={fechar}
      title="Editar lançamento de exame"
      size="lg"
      centered
    >
      {lancamento && (
        <form onSubmit={form.onSubmit(aoSubmeter)}>
          <Stack>
            <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
              Técnico, paciente e exame não podem ser alterados após o registro, para preservar a integridade
              do histórico. Para corrigir um vínculo errado, remova este lançamento (preserva auditoria) e
              registre um novo.
            </Alert>
            <Group grow>
              <TextInput label="Técnico responsável" value={lancamento.tecnico.nome} disabled />
              <TextInput label="Paciente" value={lancamento.paciente.nome} disabled />
            </Group>
            <TextInput
              label="Exame"
              value={`${lancamento.exame.nome} (${lancamento.exame.codigo})`}
              disabled
            />
            <Group grow>
              <DatePickerInput
                label="Data do exame"
                required
                valueFormat="DD/MM/YYYY"
                {...form.getInputProps('data')}
              />
              <NumberInput
                label="Quantidade"
                required
                min={1}
                max={1000}
                {...form.getInputProps('quantidade')}
              />
            </Group>
            <NumberInput
              label="Valor (R$)"
              required
              min={0}
              decimalScale={2}
              fixedDecimalScale
              decimalSeparator=","
              thousandSeparator="."
              {...form.getInputProps('valor')}
              value={form.values.valor === '' ? '' : Number(form.values.valor)}
              onChange={(valor) => form.setFieldValue('valor', valor === '' ? '' : String(valor))}
            />
            <Textarea
              label="Observações"
              placeholder="Opcional"
              maxLength={500}
              {...form.getInputProps('observacoes')}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={fechar}>
                Cancelar
              </Button>
              <Button type="submit" loading={atualizarLancamento.isPending}>
                Salvar alterações
              </Button>
            </Group>
          </Stack>
        </form>
      )}
      {!lancamento && (
        <Text size="sm" c="dimmed">
          Nenhum lançamento selecionado.
        </Text>
      )}
    </Modal>
  );
}

function formatarData(data: Date): string {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}
