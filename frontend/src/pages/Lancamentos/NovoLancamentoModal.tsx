import { useState } from 'react';
import { Button, Group, Modal, NumberInput, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { isAxiosError } from 'axios';
import { useAuth } from '@/auth/AuthContext';
import { useTecnicosParaSelecao } from '@/api/tecnicos';
import { useExamesParaSelecao } from '@/api/exames';
import { usePacientesParaSelecao } from '@/api/pacientes';
import { useConveniosParaSelecao } from '@/api/convenios';
import { useCriarLancamento } from '@/api/lancamentos';

interface NovoLancamentoModalProps {
  aberto: boolean;
  aoFechar: () => void;
}

interface FormValues {
  tecnicoId: string | null;
  pacienteId: string | null;
  exameId: string | null;
  convenioId: string | null;
  data: Date | null;
  quantidade: number;
  valor: string;
  observacoes: string;
}

export function NovoLancamentoModal({ aberto, aoFechar }: NovoLancamentoModalProps) {
  const { usuario } = useAuth();
  const isTecnico = usuario?.papel === 'TECNICO';

  const [buscaPaciente, setBuscaPaciente] = useState('');
  const [valorUnitario, setValorUnitario] = useState(0);

  const { data: tecnicos } = useTecnicosParaSelecao();
  const { data: exames } = useExamesParaSelecao();
  const { data: pacientes } = usePacientesParaSelecao(buscaPaciente);
  const { data: convenios } = useConveniosParaSelecao();
  const criarLancamento = useCriarLancamento();

  const form = useForm<FormValues>({
    initialValues: {
      tecnicoId: isTecnico ? (usuario?.tecnicoId ?? null) : null,
      pacienteId: null,
      exameId: null,
      convenioId: null,
      data: new Date(),
      quantidade: 1,
      valor: '',
      observacoes: '',
    },
    validate: {
      tecnicoId: (valor) => (valor ? null : 'Selecione o técnico responsável.'),
      pacienteId: (valor) => (valor ? null : 'Selecione o paciente.'),
      exameId: (valor) => (valor ? null : 'Selecione o exame realizado.'),
      data: (valor) => (valor ? null : 'Informe a data do exame.'),
      quantidade: (valor) => (valor > 0 ? null : 'Quantidade deve ser maior que zero.'),
      valor: (valor) => (/^\d+([.,]\d{1,2})?$/.test(valor) ? null : 'Informe um valor válido (ex.: 45.00).'),
    },
  });

  function aoSelecionarExame(exameId: string | null) {
    form.setFieldValue('exameId', exameId);
    const exame = exames?.find((e) => e.id === exameId);
    if (exame) {
      const unitario = Number(exame.valorPadrao);
      setValorUnitario(unitario);
      form.setFieldValue('valor', (unitario * form.values.quantidade).toFixed(2));
    } else {
      setValorUnitario(0);
      form.setFieldValue('valor', '');
    }
  }

  function aoMudarQuantidade(novaQtd: string | number) {
    const qtd = typeof novaQtd === 'number' ? novaQtd : Number(novaQtd);
    form.setFieldValue('quantidade', qtd);
    if (valorUnitario > 0 && qtd > 0) {
      form.setFieldValue('valor', (valorUnitario * qtd).toFixed(2));
    }
  }

  async function aoSubmeter(valores: FormValues) {
    try {
      await criarLancamento.mutateAsync({
        tecnicoId: valores.tecnicoId!,
        pacienteId: valores.pacienteId!,
        exameId: valores.exameId!,
        convenioId: valores.convenioId ?? undefined,
        data: formatarData(valores.data!),
        quantidade: valores.quantidade,
        valor: valores.valor.replace(',', '.'),
        observacoes: valores.observacoes || undefined,
      });
      notifications.show({
        color: 'green',
        title: 'Lançamento registrado',
        message: 'Operação concluída com sucesso.',
      });
      setValorUnitario(0);
      form.reset();
      aoFechar();
    } catch (erro) {
      const mensagem = isAxiosError(erro)
        ? (erro.response?.data as { message?: string } | undefined)?.message
        : undefined;
      notifications.show({
        color: 'red',
        title: 'Não foi possível registrar o lançamento',
        message: mensagem ?? 'Tente novamente em instantes.',
      });
    }
  }

  const nomeTecnicoLogado =
    tecnicos?.find((t) => t.id === usuario?.tecnicoId)?.nome ?? usuario?.nome ?? '';

  return (
    <Modal opened={aberto} onClose={aoFechar} title="Novo lançamento de exame" size="lg" centered>
      <form onSubmit={form.onSubmit(aoSubmeter)}>
        <Stack>
          {isTecnico ? (
            <TextInput
              label="Técnico responsável"
              value={nomeTecnicoLogado}
              disabled
            />
          ) : (
            <Select
              label="Técnico responsável"
              placeholder="Selecione"
              searchable
              required
              data={(tecnicos ?? []).map((t) => ({ value: t.id, label: t.nome }))}
              {...form.getInputProps('tecnicoId')}
            />
          )}
          <Select
            label="Paciente"
            placeholder="Digite ao menos 2 letras para buscar…"
            searchable
            required
            searchValue={buscaPaciente}
            onSearchChange={setBuscaPaciente}
            data={(pacientes ?? []).map((p) => ({ value: p.id, label: p.nome }))}
            {...form.getInputProps('pacienteId')}
          />
          <Select
            label="Convênio"
            placeholder="Particular (sem convênio)"
            searchable
            clearable
            data={(convenios ?? []).map((c) => ({ value: c.id, label: c.nome }))}
            value={form.values.convenioId}
            onChange={(valor) => form.setFieldValue('convenioId', valor)}
          />
          <Select
            label="Exame"
            placeholder="Selecione"
            searchable
            required
            data={(exames ?? []).map((e) => ({ value: e.id, label: `${e.nome} (${e.codigo})` }))}
            value={form.values.exameId}
            onChange={aoSelecionarExame}
            error={form.errors.exameId}
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
              value={form.values.quantidade}
              onChange={aoMudarQuantidade}
              error={form.errors.quantidade}
            />
          </Group>
          <NumberInput
            label="Valor total (R$)"
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
            <Button variant="default" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" loading={criarLancamento.isPending}>
              Registrar lançamento
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function formatarData(data: Date): string {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}
