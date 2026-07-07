import { useState } from 'react';
import {
  Box,
  Card,
  ColorSwatch,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { CompositeChart } from '@mantine/charts';
import type { TooltipProps } from 'recharts';
import { useEvolucaoMensal } from '@/api/lancamentos';
import { useTecnicosParaSelecao } from '@/api/tecnicos';
import { useEspecialidadesParaSelecao } from '@/api/especialidades';
import { useAuth } from '@/auth/AuthContext';

const SERIES = [
  { name: 'Faturamento', color: 'teal.6', type: 'area' as const, yAxisId: 'left' },
  { name: 'Exames', color: 'blue.5', type: 'bar' as const, yAxisId: 'right' },
];

export function GraficoEvolucao() {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const { usuario } = useAuth();
  const isTecnico = usuario?.papel === 'TECNICO';

  const [tecnicoId, setTecnicoId] = useState<string | null>(null);
  const [especialidadeId, setEspecialidadeId] = useState<string | null>(null);

  const { data: tecnicos } = useTecnicosParaSelecao();
  const { data: especialidades } = useEspecialidadesParaSelecao();
  const { data: pontos, isLoading } = useEvolucaoMensal({ tecnicoId, especialidadeId });

  const dadosGrafico = (pontos ?? []).map((p) => ({
    mes: p.rotulo,
    Faturamento: Number(p.faturamento),
    Exames: p.quantidade,
  }));

  const gradientTop = dark ? theme.colors.teal[7] : theme.colors.teal[6];
  const gradientBottom = dark ? theme.colors.blue[8] : theme.colors.blue[6];

  return (
    <Card withBorder padding={0} radius="md" style={{ overflow: 'hidden' }}>
      <Box
        style={{
          background: `linear-gradient(135deg, ${gradientTop} 0%, ${gradientBottom} 100%)`,
          padding: '20px 24px 18px',
        }}
      >
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
          <Stack gap={2}>
            <Text c="white" fw={700} size="lg">
              Evolução dos Últimos 12 Meses
            </Text>
            <Text c="rgba(255,255,255,0.75)" size="sm">
              Faturamento mensal e quantidade de exames realizados
            </Text>
          </Stack>

          <Group gap="sm" wrap="wrap">
            {!isTecnico && (
              <Select
                placeholder="Todos os técnicos"
                clearable
                searchable
                size="xs"
                data={(tecnicos ?? []).map((t) => ({ value: t.id, label: t.nome }))}
                value={tecnicoId}
                onChange={setTecnicoId}
                styles={{
                  input: {
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: 'white',
                  },
                }}
                w={180}
              />
            )}
            <Select
              placeholder="Todas as especialidades"
              clearable
              searchable
              size="xs"
              data={(especialidades ?? []).map((e) => ({ value: e.id, label: e.nome }))}
              value={especialidadeId}
              onChange={setEspecialidadeId}
              styles={{
                input: {
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'white',
                },
              }}
              w={200}
            />
          </Group>
        </Group>
      </Box>

      <Box p="md">
        {isLoading ? (
          <Group justify="center" py="xl">
            <Loader size="md" />
          </Group>
        ) : (
          <CompositeChart
            h={300}
            data={dadosGrafico}
            dataKey="mes"
            series={SERIES}
            withRightYAxis
            withLegend
            curveType="monotone"
            withDots={false}
            areaProps={{ fillOpacity: 0.25 }}
            barProps={{ radius: [4, 4, 0, 0] as unknown as number, maxBarSize: 32 }}
            yAxisProps={{
              yAxisId: 'left',
              tickFormatter: (v: number) =>
                new Intl.NumberFormat('pt-BR', {
                  notation: 'compact',
                  style: 'currency',
                  currency: 'BRL',
                  maximumFractionDigits: 1,
                }).format(v),
              width: 72,
            }}
            rightYAxisProps={{
              yAxisId: 'right',
              tickFormatter: (v: number) => String(v),
              width: 40,
            }}
            tooltipProps={{ content: TooltipEvolucao }}
            gridColor={dark ? 'dark.5' : 'gray.2'}
            tickLine="none"
          />
        )}
      </Box>
    </Card>
  );
}

function TooltipEvolucao({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const faturamento = payload.find((p) => p.name === 'Faturamento')?.value ?? 0;
  const exames = payload.find((p) => p.name === 'Exames')?.value ?? 0;

  return (
    <Card withBorder shadow="md" p="sm" radius="md" miw={200}>
      <Text size="xs" c="dimmed" fw={600} mb={8}>
        {label}
      </Text>
      <Group gap="xs" mb={6} justify="space-between">
        <Group gap={6}>
          <ColorSwatch color="var(--mantine-color-teal-6)" size={10} withShadow={false} />
          <Text size="sm">Faturamento</Text>
        </Group>
        <Text size="sm" fw={700}>
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(faturamento))}
        </Text>
      </Group>
      <Group gap="xs" justify="space-between">
        <Group gap={6}>
          <ColorSwatch color="var(--mantine-color-blue-5)" size={10} withShadow={false} />
          <Text size="sm">Exames</Text>
        </Group>
        <Text size="sm" fw={700}>
          {Number(exames)} exame{Number(exames) !== 1 ? 's' : ''}
        </Text>
      </Group>
    </Card>
  );
}
