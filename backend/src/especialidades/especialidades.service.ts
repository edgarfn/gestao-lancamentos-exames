import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuditContext } from '../common/decorators/request-context';
import { paginar, ResultadoPaginado } from '../common/dto/pagination-query.dto';
import { CreateEspecialidadeDto } from './dto/create-especialidade.dto';
import { UpdateEspecialidadeDto } from './dto/update-especialidade.dto';
import { QueryEspecialidadeDto } from './dto/query-especialidade.dto';

@Injectable()
export class EspecialidadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async criar(dto: CreateEspecialidadeDto, ctx: AuditContext) {
    const especialidade = await this.prisma.especialidade.create({
      data: {
        nome: dto.nome,
        descricao: dto.descricao ?? null,
        ativo: dto.ativo ?? true,
      },
    });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'CRIACAO',
      entidade: 'Especialidade',
      entidadeId: especialidade.id,
      dadosNovos: { id: especialidade.id, nome: especialidade.nome, ativo: especialidade.ativo },
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });

    return especialidade;
  }

  async listar(query: QueryEspecialidadeDto): Promise<ResultadoPaginado<unknown>> {
    const where: Prisma.EspecialidadeWhereInput = {
      deletadoEm: null,
      ...(query.busca ? { nome: { contains: query.busca, mode: 'insensitive' } } : {}),
      ...(query.ativo !== undefined ? { ativo: query.ativo === 'true' } : {}),
    };

    const [itens, total] = await this.prisma.$transaction([
      this.prisma.especialidade.findMany({ where, orderBy: { nome: 'asc' }, skip: query.skip, take: query.take }),
      this.prisma.especialidade.count({ where }),
    ]);

    return paginar(itens, total, query.pagina, query.tamanhoPagina);
  }

  async buscarPorId(id: string) {
    const especialidade = await this.prisma.especialidade.findFirst({ where: { id, deletadoEm: null } });
    if (!especialidade) {
      throw new NotFoundException('Especialidade não encontrada.');
    }
    return especialidade;
  }

  async atualizar(id: string, dto: UpdateEspecialidadeDto, ctx: AuditContext) {
    const atual = await this.prisma.especialidade.findFirst({ where: { id, deletadoEm: null } });
    if (!atual) {
      throw new NotFoundException('Especialidade não encontrada.');
    }

    const atualizado = await this.prisma.especialidade.update({
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
      entidade: 'Especialidade',
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
    const atual = await this.prisma.especialidade.findFirst({ where: { id, deletadoEm: null } });
    if (!atual) {
      throw new NotFoundException('Especialidade não encontrada.');
    }

    await this.prisma.especialidade.update({ where: { id }, data: { deletadoEm: new Date(), ativo: false } });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'EXCLUSAO',
      entidade: 'Especialidade',
      entidadeId: id,
      dadosAntigos: { id: atual.id, nome: atual.nome, ativo: atual.ativo },
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });
  }

  /** Lista compacta para preencher dropdowns de seleção (somente ativas). */
  async listarParaSelecao(): Promise<{ id: string; nome: string }[]> {
    return this.prisma.especialidade.findMany({
      where: { deletadoEm: null, ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });
  }
}
