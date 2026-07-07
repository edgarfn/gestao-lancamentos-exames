import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Code,
  Grid,
  Group,
  Modal,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconEye, IconX } from '@tabler/icons-react';
import { useAuditoria, useEntidadesAuditoria, type FiltroAuditoria } from '@/api/auditoria';
import { useUsuarios } from '@/api/usuarios';
import type { AcaoAuditoria, RegistroAuditoria } from '@/types/domain';

const FILTRO_INICIAL: FiltroAuditoria = {
  pagina: 1,
  tamanhoPagina: 20,
};

const OPCOES_OPERACAO: { value: AcaoAuditoria; label: string }[] = [
  { value: 'CRIACAO', label: 'Cadastro' },
  { value: 'ATUALIZACAO', label: 'Alteração' },
  { value: 'EXCLUSAO', label: 'Exclusão' },
  { value: 'ANONIMIZACAO', label: 'Anonimização' },
  { value: 'EXPORTACAO', label: 'Exportação' },
  { value: 'LEITURA', label: 'Leitura' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGIN_FALHO', label: 'Falha de login' },
];

const ROTULOS_CADASTRO: Record<string, string> = {
  Tecnico: 'Técnico',
  Paciente: 'Paciente',
  Exame: 'Exame',
  Lancamento: 'Lançamento',
  Usuario: 'Usuário',
};

/**
 * Trilha de auditoria — controle completo das operações realizadas no
 * sistema (quem, quando, o quê), filtrável por operador, tipo de operação,
 * cadastro afetado e período. Restrita a ADMIN: a tabela "audit_logs" é
 * somente-inserção (imutável) e atende ao princípio de responsabilização
 * (accountability) previsto na LGPD.
 */
export function AuditoriaPage() {
  const [filtro, setFiltro] = useState<FiltroAuditoria>(FILTRO_INICIAL);
  const [registroDetalhado, setRegistroDetalhado] = useState<RegistroAuditoria | null>(null);

  const { data: resultado, isLoading } = useAuditoria(filtro);
  const { data: usuarios } = useUsuarios();
  const { data: entidades } = useEntidadesAuditoria();

  function atualizar(parcial: Partial<FiltroAuditoria>) {
    setFiltro((atual) => ({ ...atual, ...parcial, pagina: 1 }));
  }

  function limparFiltros() {
    setFiltro(FILTRO_INICIAL);
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Auditoria do sistema</Title>
      </Group>

      <Text size="sm" c="dimmed">
        Consulte aqui o histórico completo de operações realizadas no sistema — quem fez, o que fez, quando e
        sobre qual cadastro. Os registros são gravados automaticamente e não podem ser alterados ou apagados,
        garantindo uma trilha confiável para fins de responsabilização e conformidade com a LGPD.
      </Text>

      <Card withBorder padding="md">
        <Grid align="end" mb="md">
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Select
              label="Operador"
              placeholder="Todos"
              searchable
              clearable
              data={(usuarios ?? []).map((u) => ({ value: u.id, label: `${u.nome} (${u.email})` }))}
              value={filtro.usuarioId ?? null}
              onChange={(valor) => atualizar({ usuarioId: valor })}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Select
              label="Operação realizada"
              placeholder="Todas"
              clearable
              data={OPCOES_OPERACAO}
              value={filtro.acao ?? null}
              onChange={(valor) => atualizar({ acao: valor as AcaoAuditoria | null })}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Select
              label="Cadastro afetado"
              placeholder="Todos"
              clearable
              data={(entidades ?? []).map((entidade) => ({
                value: entidade,
                label: ROTULOS_CADASTRO[entidade] ?? entidade,
              }))}
              value={filtro.entidade ?? null}
              onChange={(valor) => atualizar({ entidade: valor })}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <DatePickerInput
              type="range"
              label="Período"
              placeholder="Selecione o intervalo"
              clearable
              valueFormat="DD/MM/YYYY"
              value={[
                filtro.dataInicio ? new Date(`${filtro.dataInicio}T00:00:00`) : null,
                filtro.dataFim ? new Date(`${filtro.dataFim}T00:00:00`) : null,
              ]}
              onChange={([inicio, fim]) =>
                atualizar({
                  dataInicio: inicio ? formatarData(inicio) : null,
                  dataFim: fim ? formatarData(fim) : null,
                })
              }
            />
          </Grid.Col>
          <Grid.Col span="content">
            <Button variant="default" leftSection={<IconX size={16} />} onClick={limparFiltros}>
              Limpar filtros
            </Button>
          </Grid.Col>
        </Grid>

        <Table.ScrollContainer minWidth={900}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Data/hora</Table.Th>
                <Table.Th>Operador</Table.Th>
                <Table.Th>Operação</Table.Th>
                <Table.Th>Cadastro afetado</Table.Th>
                <Table.Th>Endereço IP</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(resultado?.itens ?? []).map((registro) => (
                <Table.Tr key={registro.id}>
                  <Table.Td>{formatarDataHora(registro.criadoEm)}</Table.Td>
                  <Table.Td>
                    {registro.operador ? (
                      <Stack gap={0}>
                        <Text size="sm">{registro.operador.nome}</Text>
                        <Text size="xs" c="dimmed">
                          {registro.operador.email}
                        </Text>
                      </Stack>
                    ) : (
                      <Text size="sm" c="dimmed">
                        Sistema / não identificado
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={corDaOperacao(registro.acao)} variant="light">
                      {rotuloDaOperacao(registro.acao)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{ROTULOS_CADASTRO[registro.entidade] ?? registro.entidade}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {registro.enderecoIp ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label="Ver detalhes do registro">
                      <ActionIcon variant="subtle" onClick={() => setRegistroDetalhado(registro)}>
                        <IconEye size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        {!isLoading && (resultado?.itens.length ?? 0) === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            Nenhum registro de auditoria encontrado para os filtros informados.
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

      <Modal
        opened={registroDetalhado !== null}
        onClose={() => setRegistroDetalhado(null)}
        title="Detalhes do registro de auditoria"
        size="lg"
        centered
      >
        {registroDetalhado && (
          <Stack gap="sm">
            <Group gap="xs">
              <Badge color={corDaOperacao(registroDetalhado.acao)} variant="light">
                {rotuloDaOperacao(registroDetalhado.acao)}
              </Badge>
              <Text size="sm">
                {ROTULOS_CADASTRO[registroDetalhado.entidade] ?? registroDetalhado.entidade}
                {registroDetalhado.entidadeId && (
                  <Text span c="dimmed">
                    {' '}
                    — id {registroDetalhado.entidadeId}
                  </Text>
                )}
              </Text>
            </Group>
            <Text size="sm">
              <strong>Quando:</strong> {formatarDataHora(registroDetalhado.criadoEm)}
            </Text>
            <Text size="sm">
              <strong>Operador:</strong>{' '}
              {registroDetalhado.operador
                ? `${registroDetalhado.operador.nome} (${registroDetalhado.operador.email})`
                : 'Sistema / não identificado'}
            </Text>
            <Text size="sm">
              <strong>IP do cliente:</strong> {registroDetalhado.enderecoIp ?? '—'}
            </Text>
            {registroDetalhado.enderecoIpProxy && (
              <Text size="sm">
                <strong>IP do proxy/rede:</strong> {registroDetalhado.enderecoIpProxy}
              </Text>
            )}
            <Text size="sm">
              <strong>Dispositivo/navegador:</strong> {registroDetalhado.userAgent ?? '—'}
            </Text>

            {registroDetalhado.dadosAntigos && (
              <Stack gap={4}>
                <Text size="sm" fw={600}>
                  Dados antes da operação
                </Text>
                <Code block>{JSON.stringify(registroDetalhado.dadosAntigos, null, 2)}</Code>
              </Stack>
            )}
            {registroDetalhado.dadosNovos && (
              <Stack gap={4}>
                <Text size="sm" fw={600}>
                  Dados após a operação
                </Text>
                <Code block>{JSON.stringify(registroDetalhado.dadosNovos, null, 2)}</Code>
              </Stack>
            )}
            <Text size="xs" c="dimmed">
              Por proteção de dados (LGPD), apenas identificadores e campos não sensíveis são registrados
              nestes snapshots — dados sensíveis (CPF, contato, etc.) nunca são gravados na trilha de
              auditoria em texto claro.
            </Text>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

function rotuloDaOperacao(acao: AcaoAuditoria): string {
  return OPCOES_OPERACAO.find((opcao) => opcao.value === acao)?.label ?? acao;
}

function corDaOperacao(acao: AcaoAuditoria): string {
  switch (acao) {
    case 'CRIACAO':
      return 'green';
    case 'ATUALIZACAO':
      return 'blue';
    case 'EXCLUSAO':
      return 'red';
    case 'ANONIMIZACAO':
      return 'grape';
    case 'EXPORTACAO':
      return 'orange';
    case 'LOGIN':
      return 'teal';
    case 'LOGIN_FALHO':
      return 'red';
    case 'LEITURA':
    default:
      return 'gray';
  }
}

function formatarData(data: Date): string {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function formatarDataHora(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(data));
}
