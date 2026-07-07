import { Button, Grid, Select, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconSearch, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { useTecnicosParaSelecao } from '@/api/tecnicos';
import { useExamesParaSelecao } from '@/api/exames';
import { usePacientesParaSelecao } from '@/api/pacientes';
import { useEspecialidadesParaSelecao } from '@/api/especialidades';
import { useConveniosParaSelecao } from '@/api/convenios';
import { useAuth } from '@/auth/AuthContext';
import type { FiltroLancamentos } from '@/api/lancamentos';

interface FiltrosLancamentosProps {
  filtro: FiltroLancamentos;
  aoMudar: (filtro: FiltroLancamentos) => void;
}

export function FiltrosLancamentos({ filtro, aoMudar }: FiltrosLancamentosProps) {
  const { usuario } = useAuth();
  const isTecnico = usuario?.papel === 'TECNICO';
  const [buscaPaciente, setBuscaPaciente] = useState('');
  const [pendingData, setPendingData] = useState<[Date | null, Date | null]>([
    filtro.dataInicio ? new Date(`${filtro.dataInicio}T00:00:00`) : null,
    filtro.dataFim ? new Date(`${filtro.dataFim}T00:00:00`) : null,
  ]);

  const { data: tecnicos } = useTecnicosParaSelecao();
  const { data: exames } = useExamesParaSelecao();
  const { data: pacientes } = usePacientesParaSelecao(buscaPaciente);
  const { data: especialidades } = useEspecialidadesParaSelecao();
  const { data: convenios } = useConveniosParaSelecao();

  function atualizar(parcial: Partial<FiltroLancamentos>) {
    aoMudar({ ...filtro, ...parcial, pagina: 1 });
  }

  function limparFiltros() {
    setBuscaPaciente('');
    setPendingData([null, null]);
    aoMudar({ pagina: 1, tamanhoPagina: filtro.tamanhoPagina, ordenarPor: filtro.ordenarPor });
  }


  return (
    <Grid align="end" mb="md">
      <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
        <Select
          label="Especialidade"
          placeholder="Todas"
          searchable
          clearable
          data={(especialidades ?? []).map((e) => ({ value: e.id, label: e.nome }))}
          value={filtro.especialidadeId ?? null}
          onChange={(valor) => atualizar({ especialidadeId: valor })}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
        <Select
          label="Convênio"
          placeholder="Todos"
          searchable
          clearable
          data={(convenios ?? []).map((c) => ({ value: c.id, label: c.nome }))}
          value={filtro.convenioId ?? null}
          onChange={(valor) => atualizar({ convenioId: valor })}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
        <Select
          label="Exame"
          placeholder="Todos"
          searchable
          clearable
          data={(exames ?? []).map((e) => ({ value: e.id, label: `${e.nome} (${e.codigo})` }))}
          value={filtro.exameId ?? null}
          onChange={(valor) => atualizar({ exameId: valor })}
        />
      </Grid.Col>
      {!isTecnico && (
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Select
            label="Técnico"
            placeholder="Todos"
            searchable
            clearable
            data={(tecnicos ?? []).map((t) => ({ value: t.id, label: t.nome }))}
            value={filtro.tecnicoId ?? null}
            onChange={(valor) => atualizar({ tecnicoId: valor })}
          />
        </Grid.Col>
      )}
      <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
        <Select
          label="Paciente"
          placeholder="Digite ao menos 2 letras…"
          searchable
          clearable
          searchValue={buscaPaciente}
          onSearchChange={setBuscaPaciente}
          data={(pacientes ?? []).map((p) => ({ value: p.id, label: p.nome }))}
          value={filtro.pacienteId ?? null}
          onChange={(valor) => atualizar({ pacienteId: valor })}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6, md: 6 }}>
        <DatePickerInput
          type="range"
          numberOfColumns={2}
          label="Período (data do exame)"
          placeholder="Selecione o intervalo"
          clearable
          valueFormat="DD/MM/YYYY"
          value={pendingData}
          onChange={(value) => {
            setPendingData(value);
            const [inicio, fim] = value;
            if ((inicio && fim) || (!inicio && !fim)) {
              atualizar({
                dataInicio: inicio ? formatarData(inicio) : null,
                dataFim: fim ? formatarData(fim) : null,
              });
            }
          }}
        />
      </Grid.Col>
      <Grid.Col span="content">
        <Button variant="default" leftSection={<IconX size={16} />} onClick={limparFiltros}>
          Limpar filtros
        </Button>
      </Grid.Col>
      <Grid.Col span="auto">
        <TextInput
          disabled
          leftSection={<IconSearch size={16} />}
          placeholder="Os filtros acima já buscam automaticamente"
          variant="unstyled"
        />
      </Grid.Col>
    </Grid>
  );
}

function formatarData(data: Date): string {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}
