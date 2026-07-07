import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuditContext } from '../common/decorators/request-context';
import { paginar, ResultadoPaginado } from '../common/dto/pagination-query.dto';
import { CreateConvenioDto } from './dto/create-convenio.dto';
import { UpdateConvenioDto } from './dto/update-convenio.dto';
import { QueryConvenioDto } from './dto/query-convenio.dto';

@Injectable()
export class ConveniosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async criar(dto: CreateConvenioDto, ctx: AuditContext) {
    const convenio = await this.prisma.convenio.create({
      data: {
        nome: dto.nome,
        descricao: dto.descricao ?? null,
        ativo: dto.ativo ?? true,
      },
    });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'CRIACAO',
      entidade: 'Convenio',
      entidadeId: convenio.id,
      dadosNovos: { id: convenio.id, nome: convenio.nome, ativo: convenio.ativo },
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });

    return convenio;
  }

  async listar(query: QueryConvenioDto): Promise<ResultadoPaginado<unknown>> {
    const where: Prisma.ConvenioWhereInput = {
      deletadoEm: null,
      ...(query.busca ? { nome: { contains: query.busca, mode: 'insensitive' } } : {}),
      ...(query.ativo !== undefined ? { ativo: query.ativo === 'true' } : {}),
    };

    const [itens, total] = await this.prisma.$transaction([
      this.prisma.convenio.findMany({ where, orderBy: { nome: 'asc' }, skip: query.skip, take: query.take }),
      this.prisma.convenio.count({ where }),
    ]);

    return paginar(itens, total, query.pagina, query.tamanhoPagina);
  }

  async buscarPorId(id: string) {
    const convenio = await this.prisma.convenio.findFirst({ where: { id, deletadoEm: null } });
    if (!convenio) {
      throw new NotFoundException('Convênio não encontrado.');
    }
    return convenio;
  }

  async atualizar(id: string, dto: UpdateConvenioDto, ctx: AuditContext) {
    const atual = await this.prisma.convenio.findFirst({ where: { id, deletadoEm: null } });
    if (!atual) {
      throw new NotFoundException('Convênio não encontrado.');
    }

    const atualizado = await this.prisma.convenio.update({
      where: { id },
      data: {
        nome: dto.nome ?? atual.nome,
        descricao: dto.descricao !== undefined ? dto.descricao : atual.descricao,
        ativo: dto.ativo ?? atual.ativo,
      },
    });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'ATUALIZACAO',
      entidade: 'Convenio',
      entidadeId: id,
      dadosAntigos: { id: atual.id, nome: atual.nome, ativo: atual.ativo },
      dadosNovos: { id: atualizado.id, nome: atualizado.nome, ativo: atualizado.ativo },
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });

    return atualizado;
  }

  async remover(id: string, ctx: AuditContext): Promise<void> {
    const atual = await this.prisma.convenio.findFirst({ where: { id, deletadoEm: null } });
    if (!atual) {
      throw new NotFoundException('Convênio não encontrado.');
    }

    await this.prisma.convenio.update({ where: { id }, data: { deletadoEm: new Date(), ativo: false } });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'EXCLUSAO',
      entidade: 'Convenio',
      entidadeId: id,
      dadosAntigos: { id: atual.id, nome: atual.nome, ativo: atual.ativo },
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });
  }

  /** Lista compacta para preencher dropdowns de seleção (somente ativos). */
  async listarParaSelecao(): Promise<{ id: string; nome: string }[]> {
    return this.prisma.convenio.findMany({
      where: { deletadoEm: null, ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });
  }
}
