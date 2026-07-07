import { StreamableFile } from '@nestjs/common';
import { Request, Response } from 'express';
import { LancamentosController } from './lancamentos.controller';
import { LancamentosService } from './lancamentos.service';
import { AuditService } from '../common/audit/audit.service';
import { ConfiguracoesService } from '../configuracoes/configuracoes.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

function criarRequisicao(): Request {
  const usuario: AuthenticatedUser = { id: 'user-1', email: 'a@b.com', papel: 'GESTOR' };
  return { ip: '203.0.113.10', headers: { 'user-agent': 'jest-agent' }, user: usuario } as unknown as Request;
}

const contextoEsperado = { usuarioId: 'user-1', operadorPapel: 'GESTOR', enderecoIp: '203.0.113.10', enderecoIpProxy: null, userAgent: 'jest-agent' };
const usuarioAutenticado: AuthenticatedUser = { id: 'user-1', email: 'a@b.com', papel: 'GESTOR' };

describe('LancamentosController', () => {
  let service: Partial<Record<keyof LancamentosService, jest.Mock>>;
  let audit: { registrar: jest.Mock };
  let configuracoes: { obterParaPdf: jest.Mock };
  let controller: LancamentosController;

  beforeEach(() => {
    service = {
      criar: jest.fn().mockResolvedValue({ id: 'lancamento-1' }),
      listar: jest.fn().mockResolvedValue({ itens: [], total: 0 }),
      resumo: jest.fn().mockResolvedValue({ totalQuantidade: 0, totalValor: '0' }),
      buscarPorId: jest.fn().mockResolvedValue({ id: 'lancamento-1' }),
      atualizar: jest.fn().mockResolvedValue({ id: 'lancamento-1' }),
      remover: jest.fn().mockResolvedValue(undefined),
      listarParaExportacao: jest.fn().mockResolvedValue([
        {
          id: 'lancamento-1',
          data: new Date('2026-01-05T00:00:00.000Z'),
          quantidade: 2,
          valor: '300.00',
          observacoes: null,
          tecnico: { nome: 'Ana' },
          paciente: { nome: 'Maria' },
          exame: { nome: 'Hemograma', codigo: 'HEMO-001' },
        },
      ]),
      resolverRotulosFiltro: jest.fn().mockResolvedValue({
        tecnico: 'Ana',
        exame: 'Hemograma (HEMO-001)',
        paciente: null,
        especialidade: null,
      }),
    };
    audit = { registrar: jest.fn().mockResolvedValue(undefined) };
    configuracoes = {
      obterParaPdf: jest.fn().mockResolvedValue({
        nomeClinica: null, cnpj: null, endereco: null, telefone: null, emailContato: null, logoBuffer: null,
      }),
    };
    controller = new LancamentosController(
      service as unknown as LancamentosService,
      audit as unknown as AuditService,
      configuracoes as unknown as ConfiguracoesService,
    );
  });

  it('criar repassa o DTO, o id do usuário autenticado e o contexto de auditoria', async () => {
    const dto = {
      tecnicoId: 't-1',
      pacienteId: 'p-1',
      exameId: 'e-1',
      data: '2026-01-05',
      quantidade: 2,
      valor: '300.00',
    } as never;

    await controller.criar(dto, usuarioAutenticado, criarRequisicao());

    expect(service.criar).toHaveBeenCalledWith(dto, 'user-1', contextoEsperado);
  });

  it('listar e resumo repassam os filtros de consulta ao serviço', async () => {
    const query = { tecnicoId: 't-1' } as never;

    await controller.listar(query, usuarioAutenticado);
    await controller.resumo(query, usuarioAutenticado);

    expect(service.listar).toHaveBeenCalledWith(query);
    expect(service.resumo).toHaveBeenCalledWith(query);
  });

  it('listar força tecnicoId do usuário TECNICO, ignorando qualquer filtro enviado pelo cliente', async () => {
    const tecnico: AuthenticatedUser = { id: 'user-tec', email: 'tec@b.com', papel: 'TECNICO', tecnicoId: 'tecnico-42' };
    const query: Record<string, unknown> = { tecnicoId: 'tecnico-outro' };

    await controller.listar(query as never, tecnico);

    expect(service.listar).toHaveBeenCalledWith(expect.objectContaining({ tecnicoId: 'tecnico-42' }));
  });

  it('buscar e atualizar delegam ao serviço pelo id (atualizar com contexto de auditoria)', async () => {
    const dto = { quantidade: 3 } as never;

    await controller.buscar('lancamento-1');
    await controller.atualizar('lancamento-1', dto, criarRequisicao());

    expect(service.buscarPorId).toHaveBeenCalledWith('lancamento-1');
    expect(service.atualizar).toHaveBeenCalledWith('lancamento-1', dto, contextoEsperado);
  });

  it('remover delega exclusão lógica ao serviço com o contexto de auditoria', async () => {
    await controller.remover('lancamento-1', criarRequisicao());

    expect(service.remover).toHaveBeenCalledWith('lancamento-1', contextoEsperado);
  });

  it('exportarCsv gera o CSV, registra evento de auditoria EXPORTACAO com os filtros aplicados e expõe o total no cabeçalho', async () => {
    const resposta = { set: jest.fn() } as unknown as Response;
    const query = {
      tecnicoId: 't-1',
      exameId: null,
      pacienteId: undefined,
      dataInicio: '2026-01-01',
      dataFim: '2026-01-31',
    } as never;

    const csv = await controller.exportarCsv(query, criarRequisicao(), resposta);

    expect(service.listarParaExportacao).toHaveBeenCalledWith(query, 5000);
    expect(audit.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        ...contextoEsperado,
        acao: 'EXPORTACAO',
        entidade: 'Lancamento',
        dadosNovos: expect.objectContaining({
          quantidadeRegistros: 1,
          filtros: expect.objectContaining({
            tecnicoId: 't-1',
            dataInicio: '2026-01-01',
            dataFim: '2026-01-31',
          }),
        }),
      }),
    );
    expect(resposta.set).toHaveBeenCalledWith('X-Total-Exportado', '1');
    expect(csv).toContain('Hemograma');
  });

  it('exportarPdf gera o relatório em PDF, registra evento de auditoria EXPORTACAO e expõe o total no cabeçalho', async () => {
    const resposta = { set: jest.fn() } as unknown as Response;
    const query = {
      tecnicoId: 't-1',
      exameId: null,
      pacienteId: undefined,
      dataInicio: '2026-01-01',
      dataFim: '2026-01-31',
    } as never;

    const pdf = await controller.exportarPdf(query, usuarioAutenticado, criarRequisicao(), resposta);

    expect(service.listarParaExportacao).toHaveBeenCalledWith(query, 5000);
    expect(service.resumo).toHaveBeenCalledWith(query);
    expect(service.resolverRotulosFiltro).toHaveBeenCalledWith(query);
    expect(audit.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        ...contextoEsperado,
        acao: 'EXPORTACAO',
        entidade: 'Lancamento',
        dadosNovos: expect.objectContaining({
          quantidadeRegistros: 1,
          formato: 'PDF',
          filtros: expect.objectContaining({
            tecnicoId: 't-1',
            dataInicio: '2026-01-01',
            dataFim: '2026-01-31',
          }),
        }),
      }),
    );
    expect(resposta.set).toHaveBeenCalledWith('X-Total-Exportado', '1');
    expect(pdf).toBeInstanceOf(StreamableFile);

    const blocos: Buffer[] = [];
    for await (const bloco of pdf.getStream()) {
      blocos.push(bloco as Buffer);
    }
    const conteudo = Buffer.concat(blocos);
    expect(conteudo.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
