import { useState } from 'react';
import {
  ActionIcon,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useAuth } from '@/auth/AuthContext';
import { useTecnicosParaSelecao } from '@/api/tecnicos';
import { useExamesParaSelecao } from '@/api/exames';
import { usePacientesParaSelecao } from '@/api/pacientes';
import { useConveniosParaSelecao } from '@/api/convenios';
import { useCriarLancamento } from '@/api/lancamentos';

interface LinhaExame {
  rowId: string;
  exameId: string | null;
  quantidade: number;
  valor: string;
  valorUnitario: number;
  erroExame?: string;
  erroValor?: string;
}

interface FormCabecalho {
  tecnicoId: string | null;
  pacienteId: string | null;
  convenioId: string | null;
  data: Date | null;
}

interface Props {
  aberto: boolean;
  aoFechar: () => void;
}

let _rowCounter = 0;
function novaLinha(): LinhaExame {
  _rowCounter += 1;
  return { rowId: String(_rowCounter), exameId: null, quantidade: 1, valor: '', valorUnitario: 0 };
}

export function LancamentoLoteModal({ aberto, aoFechar }: Props) {
  const { usuario } = useAuth();
  const isTecnico = usuario?.papel === 'TECNICO';

  const [buscaPaciente, setBuscaPaciente] = useState('');
  const [linhas, setLinhas] = useState<LinhaExame[]>(() => [novaLinha()]);
  const [submetendo, setSubmetendo] = useState(false);

  const { data: tecnicos } = useTecnicosParaSelecao();
  const { data: exames } = useExamesParaSelecao();
  const { data: pacientes } = usePacientesParaSelecao(buscaPaciente);
  const { data: convenios } = useConveniosParaSelecao();
  const criarLancamento = useCriarLancamento();

  const nomeTecnicoLogado =
    tecnicos?.find((t) => t.id === usuario?.tecnicoId)?.nome ?? usuario?.nome ?? '';

  const form = useForm<FormCabecalho>({
    initialValues: {
      tecnicoId: isTecnico ? (usuario?.tecnicoId ?? null) : null,
      pacienteId: null,
      convenioId: null,
      data: new Date(),
    },
    validate: {
      tecnicoId: (v) => (v ? null : 'Selecione o técnico responsável.'),
      pacienteId: (v) => (v ? null : 'Selecione o paciente.'),
      data: (v) => (v ? null : 'Informe a data dos exames.'),
    },
  });

  function atualizarLinha(rowId: string, parcial: Partial<LinhaExame>) {
    setLinhas((prev) => prev.map((l) => (l.rowId === rowId ? { ...l, ...parcial } : l)));
  }

  function aoSelecionarExame(rowId: string, exameId: string | null) {
    const exame = exames?.find((e) => e.id === exameId);
    const linha = linhas.find((l) => l.rowId === rowId);
    if (!linha) return;
    const valorUnitario = exame ? Number(exame.valorPadrao) : 0;
    atualizarLinha(rowId, {
      exameId,
      valorUnitario,
      valor: valorUnitario > 0 ? (valorUnitario * linha.quantidade).toFixed(2) : '',
      erroExame: undefined,
    });
  }

  function aoMudarQuantidade(rowId: string, qtd: number) {
    const linha = linhas.find((l) => l.rowId === rowId);
    if (!linha) return;
    const valor =
      linha.valorUnitario > 0 ? (linha.valorUnitario * qtd).toFixed(2) : linha.valor;
    atualizarLinha(rowId, { quantidade: qtd, valor });
  }

  function validarLinhas(): boolean {
    let valido = true;
    setLinhas((prev) =>
      prev.map((l) => {
        const erroExame = l.exameId ? undefined : 'Selecione o exame.';
        const erroValor =
          l.valor && /^\d+([.,]\d{1,2})?$/.test(l.valor) ? undefined : 'Informe um valor válido.';
        if (erroExame || erroValor) valido = false;
        return { ...l, erroExame, erroValor };
      }),
    );
    return valido;
  }

  async function aoSubmeter(cabecalho: FormCabecalho) {
    if (linhas.length === 0) {
      notifications.show({ color: 'red', title: 'Lista vazia', message: 'Adicione ao menos um exame para lançar.' });
      return;
    }
    if (!validarLinhas()) return;

    setSubmetendo(true);
    const resultados = await Promise.allSettled(
      linhas.map((linha) =>
        criarLancamento.mutateAsync({
          tecnicoId: cabecalho.tecnicoId!,
          pacienteId: cabecalho.pacienteId!,
          convenioId: cabecalho.convenioId ?? undefined,
          exameId: linha.exameId!,
          data: formatarData(cabecalho.data!),
          quantidade: linha.quantidade,
          valor: linha.valor.replace(',', '.'),
        }),
      ),
    );
    setSubmetendo(false);

    const sucesso = resultados.filter((r) => r.status === 'fulfilled').length;
    const falha = resultados.filter((r) => r.status === 'rejected').length;

    if (falha === 0) {
      notifications.show({
        color: 'green',
        title: `${sucesso} lançamento${sucesso !== 1 ? 's' : ''} registrado${sucesso !== 1 ? 's' : ''}`,
        message: 'Todos os exames foram lançados com sucesso.',
      });
      resetar();
      aoFechar();
    } else {
      notifications.show({
        color: 'orange',
        title: `${sucesso} registrado${sucesso !== 1 ? 's' : ''}, ${falha} com falha`,
        message: 'Alguns lançamentos não puderam ser registrados. Verifique os dados e tente novamente.',
        autoClose: 8000,
      });
    }
  }

  function resetar() {
    form.reset();
    if (isTecnico) form.setFieldValue('tecnicoId', usuario?.tecnicoId ?? null);
    form.setFieldValue('data', new Date());
    setBuscaPaciente('');
    setLinhas([novaLinha()]);
  }

  function fechar() {
    resetar();
    aoFechar();
  }

  const plural = linhas.length !== 1;

  return (
    <Modal
      opened={aberto}
      onClose={fechar}
      title="Múltiplos lançamentos"
      size="xl"
      centered
    >
      <form onSubmit={form.onSubmit(aoSubmeter)}>
        <Stack>
          {/* ── Cabeçalho compartilhado ─────────────────────────────── */}
          <Group grow>
            {isTecnico ? (
              <TextInput label="Técnico responsável" value={nomeTecnicoLogado} disabled />
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
            <DatePickerInput
              label="Data dos exames"
              required
              valueFormat="DD/MM/YYYY"
              {...form.getInputProps('data')}
            />
          </Group>

          <Group grow>
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
              onChange={(v) => form.setFieldValue('convenioId', v)}
            />
          </Group>

          {/* ── Linhas de exames ─────────────────────────────────────── */}
          <Divider label="Exames a lançar" labelPosition="left" mt="xs" />

          <Stack gap="xs">
            {linhas.map((linha, idx) => (
              <Group key={linha.rowId} align="flex-start" gap="xs" wrap="nowrap">
                <Select
                  style={{ flex: 3, minWidth: 0 }}
                  label={idx === 0 ? 'Exame' : undefined}
                  placeholder="Selecione o exame"
                  searchable
                  data={(exames ?? []).map((e) => ({ value: e.id, label: `${e.nome} (${e.codigo})` }))}
                  value={linha.exameId}
                  onChange={(v) => aoSelecionarExame(linha.rowId, v)}
                  error={linha.erroExame}
                />
                <NumberInput
                  style={{ width: 88 }}
                  label={idx === 0 ? 'Qtd.' : undefined}
                  min={1}
                  max={1000}
                  value={linha.quantidade}
                  onChange={(v) => aoMudarQuantidade(linha.rowId, typeof v === 'number' ? v : 1)}
                />
                <NumberInput
                  style={{ flex: 1.5, minWidth: 0 }}
                  label={idx === 0 ? 'Valor (R$)' : undefined}
                  min={0}
                  decimalScale={2}
                  fixedDecimalScale
                  decimalSeparator=","
                  thousandSeparator="."
                  value={linha.valor === '' ? '' : Number(linha.valor)}
                  onChange={(v) =>
                    atualizarLinha(linha.rowId, {
                      valor: v === '' ? '' : String(v),
                      erroValor: undefined,
                    })
                  }
                  error={linha.erroValor}
                />
                <ActionIcon
                  variant="subtle"
                  color="red"
                  mt={idx === 0 ? 26 : 4}
                  disabled={linhas.length === 1}
                  onClick={() => setLinhas((prev) => prev.filter((l) => l.rowId !== linha.rowId))}
                  aria-label="Remover linha"
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>

          <Button
            variant="subtle"
            leftSection={<IconPlus size={16} />}
            onClick={() => setLinhas((prev) => [...prev, novaLinha()])}
            size="sm"
            justify="flex-start"
          >
            Adicionar exame
          </Button>

          {/* ── Rodapé ───────────────────────────────────────────────── */}
          <Divider />
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {linhas.length} exame{plural ? 's' : ''} na lista
            </Text>
            <Group>
              <Button variant="default" onClick={fechar} disabled={submetendo}>
                Cancelar
              </Button>
              <Button type="submit" loading={submetendo} disabled={linhas.length === 0}>
                Registrar {linhas.length} lançamento{plural ? 's' : ''}
              </Button>
            </Group>
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
