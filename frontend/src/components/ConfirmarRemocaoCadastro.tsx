import { Alert, Button, Group, Loader, Modal, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import { useResumoLancamentos, type FiltroLancamentos } from '@/api/lancamentos';

interface ConfirmarRemocaoCadastroProps {
  aberto: boolean;
  aoFechar: () => void;
  /** Nome da entidade no singular e em minúsculas — usado para compor as frases (ex.: "técnico", "exame"). */
  entidade: string;
  nomeRegistro: string;
  /** Filtro que localiza os lançamentos vinculados a este cadastro (ex.: { tecnicoId: id }). */
  filtroVinculos: FiltroLancamentos;
  aoConfirmar: () => void;
  confirmando: boolean;
}

/**
 * Modal de confirmação de remoção que verifica, em tempo real, quantos
 * lançamentos referenciam o cadastro antes de permitir a exclusão — orienta
 * o usuário sobre o impacto real da ação (em vez de um aviso genérico).
 *
 * A remoção é sempre lógica (soft delete): o registro é preservado junto com
 * o histórico de lançamentos vinculados e a trilha de auditoria; apenas deixa
 * de estar disponível para novos lançamentos. Por isso a ação nunca é bloqueada
 * por existirem vínculos — ela é apenas explicada com clareza.
 */
export function ConfirmarRemocaoCadastro({
  aberto,
  aoFechar,
  entidade,
  nomeRegistro,
  filtroVinculos,
  aoConfirmar,
  confirmando,
}: ConfirmarRemocaoCadastroProps) {
  const { data: resumo, isLoading } = useResumoLancamentos({ ...filtroVinculos, tamanhoPagina: 1 });
  const totalVinculos = resumo?.totalRegistros ?? 0;

  return (
    <Modal opened={aberto} onClose={aoFechar} title={`Remover ${entidade}`} centered>
      <Stack gap="md">
        <Text size="sm">
          Confirma a remoção do cadastro <strong>"{nomeRegistro}"</strong>?
        </Text>

        {isLoading ? (
          <Group gap="xs">
            <Loader size="xs" />
            <Text size="sm" c="dimmed">
              Verificando lançamentos vinculados a este cadastro…
            </Text>
          </Group>
        ) : totalVinculos > 0 ? (
          <Alert icon={<IconAlertTriangle size={18} />} color="yellow" variant="light">
            Este cadastro possui <strong>{totalVinculos}</strong>{' '}
            {totalVinculos === 1 ? 'lançamento vinculado' : 'lançamentos vinculados'}. Eles permanecerão
            intactos no histórico e na trilha de auditoria — a remoção apenas torna "{nomeRegistro}"
            indisponível para a criação de novos lançamentos.
          </Alert>
        ) : (
          <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light">
            Não há lançamentos vinculados a este cadastro no momento.
          </Alert>
        )}

        <Text size="xs" c="dimmed">
          A remoção é lógica (não exclui dados do banco): o registro é marcado como inativo e preservado para
          fins de auditoria e consulta histórica. Esta ação fica registrada na trilha de auditoria do sistema.
        </Text>

        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button color="red" loading={confirmando} disabled={isLoading} onClick={aoConfirmar}>
            Remover
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
