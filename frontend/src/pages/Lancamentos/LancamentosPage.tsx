import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Pagination,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IconDownload, IconEdit, IconList, IconPlus, IconTrash } from '@tabler/icons-react';
import {
  exportarLancamentosCsv,
  useLancamentos,
  useRemoverLancamento,
  useResumoLancamentos,
  type FiltroLancamentos,
} from '@/api/lancamentos';
import type { Lancamento } from '@/types/domain';
import { useAuth } from '@/auth/AuthContext';
import { EditarLancamentoModal } from './EditarLancamentoModal';
import { FiltrosLancamentos } from './FiltrosLancamentos';
import { LancamentoLoteModal } from './LancamentoLoteModal';
import { NovoLancamentoModal } from './NovoLancamentoModal';

const FILTRO_INICIAL: FiltroLancamentos = {
  pagina: 1,
  tamanhoPagina: 20,
  ordenarPor: '-data',
};

export function LancamentosPage() {
  const [filtro, setFiltro] = useState<FiltroLancamentos>(FILTRO_INICIAL);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalLoteAberto, setModalLoteAberto] = useState(false);
  const [lancamentoEmEdicao, setLancamentoEmEdicao] = useState<Lancamento | null>(null);
  const [exportando, setExportando] = useState(false);

  const { possuiPapel } = useAuth();
  const podeExportar = possuiPapel('ADMIN', 'GESTOR');
  const podeEditar = possuiPapel('ADMIN', 'GESTOR');
  const podeExcluir = possuiPapel('ADMIN', 'GESTOR');

  const { data: resultado, isLoading } = useLancamentos(filtro);
  const { data: resumo } = useResumoLancamentos(filtro);
  const removerLancamento = useRemoverLancamento();

  async function aoExportar() {
    setExportando(true);
    try {
      await exportarLancamentosCsv(filtro);
    } catch {
      notifications.show({
        color: 'red',
        title: 'Falha na exportação',
        message: 'Não foi possível gerar o arquivo CSV. Tente novamente.',
      });
    } finally {
      setExportando(false);
    }
  }

  function confirmarRemocao(id: string, descricao: string) {
    modals.openConfirmModal({
      title: 'Remover lançamento',
      centered: true,
      children: (
        <Text size="sm">
          Confirma a remoção do lançamento "{descricao}"? Esta ação registra auditoria e não pode ser desfeita
          pela interface.
        </Text>
      ),
      labels: { confirm: 'Remover', cancel: 'Cancelar' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await removerLancamento.mutateAsync(id);
          notifications.show({
            color: 'green',
            title: 'Lançamento removido',
            message: 'Operação concluída com sucesso.',
          });
        } catch {
          notifications.show({
            color: 'red',
            title: 'Falha ao remover',
            message: 'Tente novamente em instantes.',
          });
        }
      },
    });
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Lançamentos de exames</Title>
        <Group>
          {podeExportar && (
            <Button
              variant="default"
              leftSection={<IconDownload size={16} />}
              onClick={aoExportar}
              loading={exportando}
            >
              Exportar CSV
            </Button>
          )}
          <Button
            variant="default"
            leftSection={<IconList size={16} />}
            onClick={() => setModalLoteAberto(true)}
          >
            Lançar em lote
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setModalAberto(true)}>
            Novo lançamento
          </Button>
        </Group>
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
        <CartaoResumo titulo="Valor total" valor={resumo ? formatarMoeda(resumo.valorTotal) : '—'} />
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
                <Table.Th>Exame</Table.Th>
                <Table.Th>Quantidade</Table.Th>
                <Table.Th>Valor</Table.Th>
                {(podeEditar || podeExcluir) && <Table.Th />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(resultado?.itens ?? []).map((lancamento) => (
                <Table.Tr key={lancamento.id}>
                  <Table.Td>{formatarDataExibicao(lancamento.data)}</Table.Td>
                  <Table.Td>{lancamento.paciente.nome}</Table.Td>
                  <Table.Td>{lancamento.tecnico.nome}</Table.Td>
                  <Table.Td>
                    <Badge variant="light">{lancamento.exame.codigo}</Badge> {lancamento.exame.nome}
                  </Table.Td>
                  <Table.Td>{lancamento.quantidade}</Table.Td>
                  <Table.Td>{formatarMoeda(lancamento.valor)}</Table.Td>
                  {(podeEditar || podeExcluir) && (
                    <Table.Td>
                      <Group gap={4} justify="flex-end">
                        {podeEditar && (
                          <Tooltip label="Editar lançamento">
                            <ActionIcon variant="subtle" onClick={() => setLancamentoEmEdicao(lancamento)}>
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {podeExcluir && (
                          <Tooltip label="Remover lançamento">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() =>
                                confirmarRemocao(
                                  lancamento.id,
                                  `${lancamento.exame.nome} — ${lancamento.paciente.nome}`,
                                )
                              }
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        {!isLoading && (resultado?.itens.length ?? 0) === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            Nenhum lançamento encontrado para os filtros informados.
          </Text>
        )}

        {resultado && resultado.totalPaginas > 1 && (
          <Group justify="center" mt="md">
            <Pagination
              value={resultado.pagina}
              total={resultado.totalPaginas}
              onChange={(pagina) => setFiltro((atual) => ({ ...atual, pagina }))}
            />
          </Group>
        )}
      </Card>

      <NovoLancamentoModal aberto={modalAberto} aoFechar={() => setModalAberto(false)} />
      <LancamentoLoteModal aberto={modalLoteAberto} aoFechar={() => setModalLoteAberto(false)} />
      <EditarLancamentoModal
        key={lancamentoEmEdicao?.id}
        lancamento={lancamentoEmEdicao}
        aoFechar={() => setLancamentoEmEdicao(null)}
      />
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
