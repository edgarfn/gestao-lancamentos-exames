import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Papel } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { extractAuditContext } from '../common/decorators/request-context';
import { AuditService } from '../common/audit/audit.service';
import { LancamentosService } from './lancamentos.service';
import { CreateLancamentoDto } from './dto/create-lancamento.dto';
import { UpdateLancamentoDto } from './dto/update-lancamento.dto';
import { QueryLancamentoDto } from './dto/query-lancamento.dto';
import { QueryEvolucaoMensalDto } from './dto/query-evolucao-mensal.dto';
import { lancamentosParaCsv } from './lancamentos-csv.util';
import { gerarRelatorioLancamentosPdf } from './lancamentos-pdf.util';
import { ConfiguracoesService } from '../configuracoes/configuracoes.service';

const LIMITE_EXPORTACAO = 5000;

@ApiBearerAuth()
@ApiTags('Lançamentos')
@Controller({ path: 'lancamentos', version: '1' })
export class LancamentosController {
  constructor(
    private readonly service: LancamentosService,
    private readonly audit: AuditService,
    private readonly configuracoes: ConfiguracoesService,
  ) {}

  @Roles('ADMIN', 'GESTOR', 'TECNICO')
  @Post()
  criar(@Body() dto: CreateLancamentoDto, @CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.service.criar(dto, user.id, extractAuditContext(req));
  }

  @Get()
  listar(@Query() query: QueryLancamentoDto, @CurrentUser() user: AuthenticatedUser) {
    if (user.papel === Papel.TECNICO && user.tecnicoId) query.tecnicoId = user.tecnicoId;
    return this.service.listar(query);
  }

  @Get('resumo')
  resumo(@Query() query: QueryLancamentoDto, @CurrentUser() user: AuthenticatedUser) {
    if (user.papel === Papel.TECNICO && user.tecnicoId) query.tecnicoId = user.tecnicoId;
    return this.service.resumo(query);
  }

  @Get('evolucao-mensal')
  evolucaoMensal(@Query() query: QueryEvolucaoMensalDto, @CurrentUser() user: AuthenticatedUser) {
    if (user.papel === Papel.TECNICO && user.tecnicoId) query.tecnicoId = user.tecnicoId;
    return this.service.evolucaoMensal(query);
  }

  @Get(':id')
  buscar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.buscarPorId(id);
  }

  @Roles('ADMIN', 'GESTOR', 'TECNICO')
  @Patch(':id')
  atualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLancamentoDto, @Req() req: Request) {
    return this.service.atualizar(id, dto, extractAuditContext(req));
  }

  @Roles('ADMIN', 'GESTOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remover(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request): Promise<void> {
    await this.service.remover(id, extractAuditContext(req));
  }

  /**
   * Exportação em CSV dos lançamentos filtrados. Restrita a ADMIN/GESTOR
   * (princípio do menor privilégio — exportação em massa de dados associados
   * a pacientes amplia significativamente o risco de vazamento) e SEMPRE
   * gera um evento de auditoria EXPORTACAO, registrando quem exportou,
   * quando e com quais filtros — essencial para responder a eventuais
   * incidentes de privacidade (accountability/LGPD).
   */
  @Roles('ADMIN', 'GESTOR')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="lancamentos.csv"')
  @Get('exportar/csv')
  async exportarCsv(
    @Query() query: QueryLancamentoDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const itens = await this.service.listarParaExportacao(query, LIMITE_EXPORTACAO);

    await this.audit.registrar({
      ...extractAuditContext(req),
      acao: 'EXPORTACAO',
      entidade: 'Lancamento',
      dadosNovos: { filtros: this.filtrosParaAuditoria(query), quantidadeRegistros: itens.length },
    });

    res.set('X-Total-Exportado', String(itens.length));
    return lancamentosParaCsv(itens);
  }

  /**
   * Relatório em PDF dos lançamentos filtrados — mesma base da exportação
   * CSV (limite, RBAC restrito a ADMIN/GESTOR e auditoria EXPORTACAO),
   * porém em formato apto para visualização/impressão, trazendo o resumo
   * (registros, quantidade e valor calculado) exibido na tela para o filtro.
   *
   * Importante: o PDF é devolvido como StreamableFile, não como Buffer cru.
   * O adaptador HTTP do Nest serializa objetos retornados via response.json(),
   * o que transformaria o binário em texto JSON ({"type":"Buffer","data":[...]})
   * e corromperia o arquivo — StreamableFile sinaliza ao Nest para fazer streaming
   * direto dos bytes para a resposta.
   */
  @Roles('ADMIN', 'GESTOR')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="relatorio-lancamentos.pdf"')
  @Get('exportar/pdf')
  async exportarPdf(
    @Query() query: QueryLancamentoDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const [itens, resumo, rotulos, clinica] = await Promise.all([
      this.service.listarParaExportacao(query, LIMITE_EXPORTACAO),
      this.service.resumo(query),
      this.service.resolverRotulosFiltro(query),
      this.configuracoes.obterParaPdf(),
    ]);

    const pdf = await gerarRelatorioLancamentosPdf(
      itens,
      resumo,
      {
        tecnico: rotulos.tecnico,
        exame: rotulos.exame,
        paciente: rotulos.paciente,
        especialidade: rotulos.especialidade,
        convenio: rotulos.convenio,
        dataInicio: query.dataInicio ?? null,
        dataFim: query.dataFim ?? null,
      },
      user.email,
      clinica,
    );

    await this.audit.registrar({
      ...extractAuditContext(req),
      acao: 'EXPORTACAO',
      entidade: 'Lancamento',
      dadosNovos: {
        filtros: this.filtrosParaAuditoria(query),
        quantidadeRegistros: itens.length,
        formato: 'PDF',
      },
    });

    res.set('X-Total-Exportado', String(itens.length));
    return new StreamableFile(pdf);
  }

  private filtrosParaAuditoria(query: QueryLancamentoDto): Record<string, unknown> {
    return {
      exameId: query.exameId ?? null,
      tecnicoId: query.tecnicoId ?? null,
      pacienteId: query.pacienteId ?? null,
      convenioId: query.convenioId ?? null,
      dataInicio: query.dataInicio ?? null,
      dataFim: query.dataFim ?? null,
    };
  }
}
