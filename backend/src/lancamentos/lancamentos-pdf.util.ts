import PDFDocument from 'pdfkit';
import { LancamentoApresentavel, ResumoLancamentos } from './lancamentos.service';

export interface FiltrosRelatorioRotulados {
  tecnico: string | null;
  exame: string | null;
  paciente: string | null;
  especialidade: string | null;
  convenio: string | null;
  dataInicio: string | null;
  dataFim: string | null;
}

export interface ClinicaInfoPdf {
  nomeClinica: string | null;
  cnpj: string | null;
  endereco: string | null;
  telefone: string | null;
  emailContato: string | null;
  logoBuffer: Buffer | null;
}

interface ColunaTabela {
  titulo: string;
  largura: number;
  obterValor: (item: LancamentoApresentavel) => string;
}

const MARGEM = 40;
const ALTURA_LINHA = 20;
const LOGO_SIZE = 52;

const COLUNAS: ColunaTabela[] = [
  { titulo: 'Data', largura: 58, obterValor: (item) => formatarData(item.data) },
  { titulo: 'Técnico', largura: 95, obterValor: (item) => item.tecnico.nome },
  { titulo: 'Paciente', largura: 95, obterValor: (item) => item.paciente.nome },
  { titulo: 'Especialidade', largura: 80, obterValor: (item) => item.exame.especialidade?.nome ?? '—' },
  { titulo: 'Exame', largura: 97, obterValor: (item) => `${item.exame.nome} (${item.exame.codigo})` },
  { titulo: 'Qtd.', largura: 35, obterValor: (item) => String(item.quantidade) },
  { titulo: 'Valor', largura: 55, obterValor: (item) => formatarMoeda(item.valor) },
];

function formatarData(data: Date): string {
  return data.toISOString().slice(0, 10).split('-').reverse().join('/');
}

function formatarMoeda(valor: string): string {
  const numero = Number(valor);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(numero) ? numero : 0,
  );
}

function formatarDataHora(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

function desenharCabecalhoTabela(doc: PDFKit.PDFDocument, topo: number): void {
  let x = MARGEM;
  doc.font('Helvetica-Bold').fontSize(9);
  for (const coluna of COLUNAS) {
    doc.text(coluna.titulo, x, topo, { width: coluna.largura, lineBreak: false });
    x += coluna.largura;
  }
  doc
    .moveTo(MARGEM, topo + 14)
    .lineTo(x, topo + 14)
    .strokeColor('#cccccc')
    .stroke();
}

/**
 * Desenha o cabeçalho com identidade da clínica e retorna o Y após o cabeçalho.
 * Suporta logo (PNG/JPEG) ao lado dos dados de texto.
 */
function desenharCabecalhoClinica(
  doc: PDFKit.PDFDocument,
  larguraUtil: number,
  clinica: ClinicaInfoPdf,
): number {
  const y0 = MARGEM;
  const logoComSucesso = { valor: false };

  if (clinica.logoBuffer) {
    try {
      doc.image(clinica.logoBuffer, MARGEM, y0, { height: LOGO_SIZE });
      logoComSucesso.valor = true;
    } catch { /* formato não suportado pelo pdfkit, ignora logo */ }
  }

  const textX = logoComSucesso.valor ? MARGEM + LOGO_SIZE + 12 : MARGEM;
  const textW = larguraUtil - (textX - MARGEM);
  let y = y0;

  if (clinica.nomeClinica) {
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000')
       .text(clinica.nomeClinica, textX, y, { width: textW, lineBreak: false });
    y += 17;
  }

  const linhas: string[] = [];
  if (clinica.cnpj) linhas.push(`CNPJ: ${clinica.cnpj}`);
  if (clinica.endereco) linhas.push(clinica.endereco);
  const contato = [clinica.telefone, clinica.emailContato].filter(Boolean).join(' · ');
  if (contato) linhas.push(contato);

  if (linhas.length) {
    doc.font('Helvetica').fontSize(8).fillColor('#555555');
    for (const linha of linhas) {
      doc.text(linha, textX, y, { width: textW, lineBreak: false });
      y += 11;
    }
  }

  const separadorY = Math.max(y0 + LOGO_SIZE + 8, y + 8);
  doc
    .moveTo(MARGEM, separadorY)
    .lineTo(MARGEM + larguraUtil, separadorY)
    .strokeColor('#1a7f64')
    .lineWidth(1.5)
    .stroke()
    .lineWidth(1);

  return separadorY + 12;
}

/**
 * Gera o PDF do relatório de lançamentos respeitando o filtro ativo.
 * Quando fornecida, exibe a identidade da clínica no cabeçalho (logo + dados).
 */
export function gerarRelatorioLancamentosPdf(
  itens: LancamentoApresentavel[],
  resumo: ResumoLancamentos,
  filtros: FiltrosRelatorioRotulados,
  geradoPor: string,
  clinica: ClinicaInfoPdf,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGEM, size: 'A4', bufferPages: true });
    const blocos: Buffer[] = [];

    doc.on('data', (bloco: Buffer) => blocos.push(bloco));
    doc.on('end', () => resolve(Buffer.concat(blocos)));
    doc.on('error', (erro: Error) => reject(erro));

    const larguraUtil = doc.page.width - MARGEM * 2;

    // Cabeçalho da clínica — apenas quando há alguma informação configurada
    if (clinica.nomeClinica || clinica.logoBuffer) {
      const yAposHeader = desenharCabecalhoClinica(doc, larguraUtil, clinica);
      doc.x = MARGEM;
      doc.y = yAposHeader;
    }

    doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000')
       .text('Relatório de Lançamentos de Exames', { align: 'center', width: larguraUtil });
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#555555')
      .text(`Gerado em ${formatarDataHora(new Date())} por ${geradoPor}`, { align: 'center', width: larguraUtil });
    doc.moveDown(0.8);

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text('Filtros aplicados');
    doc
      .font('Helvetica')
      .fontSize(9)
      .text(`Especialidade: ${filtros.especialidade ?? 'Todas'}`)
      .text(`Convênio: ${filtros.convenio ?? 'Todos'}`)
      .text(`Técnico: ${filtros.tecnico ?? 'Todos'}`)
      .text(`Exame: ${filtros.exame ?? 'Todos'}`)
      .text(`Paciente: ${filtros.paciente ?? 'Todos'}`)
      .text(`Período: ${formatarPeriodo(filtros.dataInicio, filtros.dataFim)}`);
    doc.moveDown(0.8);

    doc.font('Helvetica-Bold').fontSize(11).text('Valor calculado para este filtro');
    doc
      .font('Helvetica')
      .fontSize(9)
      .text(`Registros encontrados: ${resumo.totalRegistros}`)
      .text(`Quantidade total: ${resumo.quantidadeTotal}`)
      .text(`Valor total: ${formatarMoeda(resumo.valorTotal)}`);
    doc.moveDown(1);

    if (itens.length === 0) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(10)
        .text('Nenhum lançamento encontrado para os filtros informados.');
      numerarPaginas(doc, clinica.nomeClinica);
      doc.end();
      return;
    }

    let topo = doc.y;
    desenharCabecalhoTabela(doc, topo);
    topo += 18;

    doc.font('Helvetica').fontSize(9).fillColor('#000000');
    for (const item of itens) {
      if (topo + ALTURA_LINHA > doc.page.height - MARGEM) {
        doc.addPage();
        topo = MARGEM;
        desenharCabecalhoTabela(doc, topo);
        topo += 18;
        doc.font('Helvetica').fontSize(9).fillColor('#000000');
      }

      let x = MARGEM;
      for (const coluna of COLUNAS) {
        doc.text(coluna.obterValor(item), x, topo, { width: coluna.largura, lineBreak: false });
        x += coluna.largura;
      }
      topo += ALTURA_LINHA;
    }

    numerarPaginas(doc, clinica.nomeClinica);
    doc.end();
  });
}

function formatarPeriodo(inicio: string | null, fim: string | null): string {
  if (!inicio && !fim) return 'Todo o período';
  const dataInicio = inicio ? inicio.split('-').reverse().join('/') : '—';
  const dataFim = fim ? fim.split('-').reverse().join('/') : '—';
  return `${dataInicio} a ${dataFim}`;
}

function numerarPaginas(doc: PDFKit.PDFDocument, nomeClinica: string | null): void {
  const paginas = doc.bufferedPageRange();
  for (let i = 0; i < paginas.count; i += 1) {
    doc.switchToPage(paginas.start + i);
    const texto = nomeClinica
      ? `${nomeClinica} — Página ${i + 1} de ${paginas.count}`
      : `Página ${i + 1} de ${paginas.count}`;
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#888888')
      .text(texto, MARGEM, doc.page.height - MARGEM + 10, {
        width: doc.page.width - MARGEM * 2,
        align: 'center',
      });
  }
}
