import { Card, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconCalendarStats, IconCoin, IconReportMedical } from '@tabler/icons-react';
import { useResumoLancamentos } from '@/api/lancamentos';
import { useAuth } from '@/auth/AuthContext';
import { GraficoEvolucao } from './GraficoEvolucao';

const FILTRO_MES_ATUAL = () => {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return {
    dataInicio: formatarData(inicio),
    dataFim: formatarData(hoje),
  };
};

export function PainelPage() {
  const { usuario } = useAuth();
  const { data: resumoMes } = useResumoLancamentos({ ...FILTRO_MES_ATUAL(), tamanhoPagina: 1 });
  const { data: resumoGeral } = useResumoLancamentos({ tamanhoPagina: 1 });

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Bem-vindo(a), {usuario?.nome}</Title>
        <Text c="dimmed">Visão geral dos lançamentos de exames registrados no sistema.</Text>
      </div>

      <Title order={4}>Mês atual</Title>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <CartaoIndicador
          icone={IconReportMedical}
          titulo="Lançamentos no mês"
          valor={resumoMes ? formatarNumero(resumoMes.totalRegistros) : '—'}
        />
        <CartaoIndicador
          icone={IconCalendarStats}
          titulo="Quantidade de exames"
          valor={resumoMes ? formatarNumero(resumoMes.quantidadeTotal) : '—'}
        />
        <CartaoIndicador
          icone={IconCoin}
          titulo="Faturamento do mês"
          valor={resumoMes ? formatarMoeda(resumoMes.valorTotal) : '—'}
        />
      </SimpleGrid>

      <Title order={4}>Histórico geral</Title>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <CartaoIndicador
          icone={IconReportMedical}
          titulo="Total de lançamentos"
          valor={resumoGeral ? formatarNumero(resumoGeral.totalRegistros) : '—'}
        />
        <CartaoIndicador
          icone={IconCalendarStats}
          titulo="Quantidade total de exames"
          valor={resumoGeral ? formatarNumero(resumoGeral.quantidadeTotal) : '—'}
        />
        <CartaoIndicador
          icone={IconCoin}
          titulo="Faturamento acumulado"
          valor={resumoGeral ? formatarMoeda(resumoGeral.valorTotal) : '—'}
        />
      </SimpleGrid>

      <GraficoEvolucao />
    </Stack>
  );
}

function CartaoIndicador({
  icone: Icone,
  titulo,
  valor,
}: {
  icone: typeof IconReportMedical;
  titulo: string;
  valor: string;
}) {
  return (
    <Card withBorder padding="lg">
      <Stack gap={4}>
        <Icone size={28} stroke={1.5} />
        <Text size="sm" c="dimmed">
          {titulo}
        </Text>
        <Text size="xl" fw={700}>
          {valor}
        </Text>
      </Stack>
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

function formatarData(data: Date): string {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}
