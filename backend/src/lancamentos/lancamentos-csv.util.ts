import { LancamentoApresentavel } from './lancamentos.service';

const CABECALHO = [
  'Data',
  'Técnico',
  'Paciente',
  'Convênio',
  'Exame',
  'Código do Exame',
  'Quantidade',
  'Valor',
  'Observações',
] as const;

/**
 * Sanitiza uma célula para evitar "CSV/Formula Injection": planilhas (Excel,
 * LibreOffice, Google Sheets) interpretam células iniciadas por
 * = + - @ \t \r como fórmulas, permitindo execução de código quando o CSV
 * exportado é reaberto. Prefixamos com apóstrofo para neutralizar e sempre
 * delimitamos com aspas, escapando aspas internas (RFC 4180).
 */
function celulaSegura(valor: string): string {
  const normalizado = valor.replace(/"/g, '""');
  const precisaNeutralizarFormula = /^[=+\-@\t\r]/.test(normalizado);
  const valorFinal = precisaNeutralizarFormula ? `'${normalizado}` : normalizado;
  return `"${valorFinal}"`;
}

function formatarData(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function lancamentosParaCsv(itens: LancamentoApresentavel[]): string {
  const linhas = itens.map((item) =>
    [
      formatarData(item.data),
      item.tecnico.nome,
      item.paciente.nome,
      item.convenio?.nome ?? '',
      item.exame.nome,
      item.exame.codigo,
      String(item.quantidade),
      item.valor,
      item.observacoes ?? '',
    ]
      .map(celulaSegura)
      .join(','),
  );

  // BOM UTF-8 garante acentuação correta ao abrir no Excel.
  return ['﻿' + CABECALHO.map(celulaSegura).join(','), ...linhas].join('\r\n');
}
