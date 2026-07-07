import { useState } from 'react';
import { Badge, Button, Card, Group, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconFileTypePdf } from '@tabler/icons-react';
import {
  exportarLancamentosPdf,
  useLancamentos,
  useResumoLancamentos,
  type FiltroLancamentos,
} from '@/api/lancamentos';
import { FiltrosLancamentos } from '../Lancamentos/FiltrosLancamentos';

const FILTRO_INICIAL: FiltroLancamentos = {
  pagina: 1,
  tamanhoPagina: 50,
  ordenarPor: '-data',
};

const LIMITE_EXIBICAO = 50;

/**
 * Tela de relatórios: apresenta os cadastros (lançamentos) realizados,
 * filtráveis por técnico, exame e data — exibindo o valor calculado para
 * o filtro ativo e permitindo gerar um relatório em PDF com esse recorte.
 * Restrita a ADMIN/GESTOR (mesmo princípio de menor privilégio aplicado à
 * exportação CSV: agrega dados associados a pacientes).
 */
export function RelatoriosPage() {
  const [filtro, setFiltro] = useState<FiltroLancamentos>(FILTRO_INICIAL);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const { data: resultado, isLoading } = useLancamentos(filtro);
  const { data: resumo } = useResumoLancamentos(filtro);

  async function aoGerarPdf() {
    setGerandoPdf(true);
    try {
      await exportarLancamentosPdf(filtro);
    } catch {
      notifications.show({
        color: 'red',
        title: 'Falha ao gerar relatório',
        message: 'Não foi possível gerar o PDF. Tente novamente.',
      });
    } finally {
      setGerandoPdf(false);
    }
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Relatórios de lançamentos</Title>
        <Button leftSection={<IconFileTypePdf size={16} />} onClick={aoGerarPdf} loading={gerandoPdf}>
          Gerar relatório em PDF
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <CartaoResumo
          titulo="Registros encontrados"
          valor={resumo ? formatarNumero(resumo.totalRegistros) : '—'}
        />
        <CartaoResumo
          titulo="Quantidade total"
          valor={resumo ? formatarNumero(resumo.quantidadeTotal) : '—'}
        />
        <CartaoResumo
          titulo="Valor calculado para o filtro"
          valor={resumo ? formatarMoeda(resumo.valorTotal) : '—'}
        />
      </SimpleGrid>

      <Card withBorder padding="md">
        <FiltrosLancamentos filtro={filtro} aoMudar={setFiltro} />

        <Table.ScrollContainer minWidth={800}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Data</Table.Th>
                <Table.Th>Paciente</Table.Th>
                <Table.Th>Técnico</Table.Th>
                <Table.Th>Especialidade</Table.Th>
                <Table.Th>Exame</Table.Th>
                <Table.Th>Quantidade</Table.Th>
                <Table.Th>Valor</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(resultado?.itens ?? []).map((lancamento) => (
                <Table.Tr key={lancamento.id}>
                  <Table.Td>{formatarDataExibicao(lancamento.data)}</Table.Td>
                  <Table.Td>{lancamento.paciente.nome}</Table.Td>
                  <Table.Td>{lancamento.tecnico.nome}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="teal">{lancamento.exame.especialidade?.nome ?? '—'}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light">{lancamento.exame.codigo}</Badge> {lancamento.exame.nome}
                  </Table.Td>
                  <Table.Td>{lancamento.quantidade}</Table.Td>
                  <Table.Td>{formatarMoeda(lancamento.valor)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        {!isLoading && (resultado?.itens.length ?? 0) === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            Nenhum cadastro encontrado para os filtros informados.
          </Text>
        )}

        {resultado && resultado.total > LIMITE_EXIBICAO && (
          <Text c="dimmed" size="sm" ta="center" mt="md">
            Exibindo os primeiros {LIMITE_EXIBICAO} de {formatarNumero(resultado.total)} registros. O
            relatório em PDF traz o conjunto completo (até 5.000 itens) para o filtro aplicado.
          </Text>
        )}
      </Card>
    </Stack>
  );
}

function CartaoResumo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <Card withBorder padding="md">
      <Text size="sm" c="dimmed">
        {titulo}
      </Text>
      <Text size="xl" fw={700}>
        {valor}
      </Text>
    </Card>
  );
}

function formatarNumero(valor: number): string {
  return new Intl.NumberFormat('pt-BR').format(valor);
}

function formatarMoeda(valor: string): string {
  const numero = Number(valor);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(numero) ? numero : 0,
  );
}

function formatarDataExibicao(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}
