import { lancamentosParaCsv } from './lancamentos-csv.util';
import type { LancamentoApresentavel } from './lancamentos.service';

function criarLancamento(parcial: Partial<LancamentoApresentavel> = {}): LancamentoApresentavel {
  return {
    id: 'lancamento-1',
    data: new Date('2026-01-15T00:00:00.000Z'),
    quantidade: 2,
    valor: '150.00',
    observacoes: null,
    tecnico: { id: 'tecnico-1', nome: 'Ana Técnica' },
    paciente: { id: 'paciente-1', nome: 'João Paciente' },
    exame: { id: 'exame-1', nome: 'Hemograma completo', codigo: 'HEMO-001', especialidade: null },
    convenio: null,
    criadoEm: new Date('2026-01-15T10:00:00.000Z'),
    atualizadoEm: new Date('2026-01-15T10:00:00.000Z'),
    ...parcial,
  };
}

describe('lancamentosParaCsv', () => {
  it('inclui BOM UTF-8 e cabeçalho com os campos esperados', () => {
    const csv = lancamentosParaCsv([]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(
      '"Data","Técnico","Paciente","Exame","Código do Exame","Quantidade","Valor","Observações"',
    );
  });

  it('formata cada lançamento como uma linha delimitada por aspas e separada por CRLF', () => {
    const csv = lancamentosParaCsv([criarLancamento()]);
    const linhas = csv.split('\r\n');

    expect(linhas).toHaveLength(2);
    expect(linhas[1]).toBe(
      '"2026-01-15","Ana Técnica","João Paciente","Hemograma completo","HEMO-001","2","150.00",""',
    );
  });

  it('neutraliza fórmulas para impedir CSV/Formula Injection', () => {
    const csv = lancamentosParaCsv([
      criarLancamento({
        observacoes: "=cmd|'/c calc'!A1",
        paciente: { id: 'paciente-2', nome: '+SOMA(A1:A2)' },
        tecnico: { id: 'tecnico-2', nome: '-1+1' },
        exame: { id: 'exame-2', nome: '@SUM(1+1)', codigo: 'X', especialidade: null },
      }),
    ]);
    const linhaDados = csv.split('\r\n')[1];

    // A célula de observações contém apóstrofos internos, que são escapados pela serialização CSV padrão (não pela neutralização de fórmula).
    expect(linhaDados).toContain("\"'=cmd|'/c calc'!A1\"");
    // Verifica que cada célula perigosa recebeu o prefixo de apóstrofo neutralizador.
    expect(linhaDados).toContain('"\'+SOMA(A1:A2)"');
    expect(linhaDados).toContain('"\'-1+1"');
    expect(linhaDados).toContain('"\'@SUM(1+1)"');
  });

  it('escapa aspas internas conforme RFC 4180', () => {
    const csv = lancamentosParaCsv([criarLancamento({ observacoes: 'Paciente disse "ok"' })]);
    const linhaDados = csv.split('\r\n')[1];

    expect(linhaDados).toContain('"Paciente disse ""ok"""');
  });
});
