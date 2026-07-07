import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuditContext } from '../common/decorators/request-context';
import { paginar, ResultadoPaginado } from '../common/dto/pagination-query.dto';
import { CreateExameDto } from './dto/create-exame.dto';
import { UpdateExameDto } from './dto/update-exame.dto';
import { QueryExameDto } from './dto/query-exame.dto';

@Injectable()
export class ExamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async criar(dto: CreateExameDto, ctx: AuditContext) {
    const existente = await this.prisma.exame.findUnique({ where: { codigo: dto.codigo } });
    if (existente) {
      throw new ConflictException('Já existe um exame cadastrado com este código.');
    }

    const exame = await this.prisma.exame.create({
      data: {
        nome: dto.nome,
        codigo: dto.codigo,
        valorPadrao: dto.valorPadrao,
        ativo: dto.ativo ?? true,
        especialidadeId: dto.especialidadeId ?? null,
      },
      include: { especialidade: { select: { id: true, nome: true } } },
    });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'CRIACAO',
      entidade: 'Exame',
      entidadeId: exame.id,
      dadosNovos: this.paraAuditoria(exame),
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });

    return exame;
  }

  async listar(query: QueryExameDto): Promise<ResultadoPaginado<unknown>> {
    const where: Prisma.ExameWhereInput = {
      deletadoEm: null,
      ...(query.busca
        ? {
            OR: [
              { nome: { contains: query.busca, mode: 'insensitive' } },
              { codigo: { contains: query.busca, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.ativo !== undefined ? { ativo: query.ativo === 'true' } : {}),
    };

    const [itens, total] = await this.prisma.$transaction([
      this.prisma.exame.findMany({
        where,
        orderBy: { nome: 'asc' },
        skip: query.skip,
        take: query.take,
        include: { especialidade: { select: { id: true, nome: true } } },
      }),
      this.prisma.exame.count({ where }),
    ]);

    return paginar(itens, total, query.pagina, query.tamanhoPagina);
  }

  async buscarPorId(id: string) {
    const exame = await this.prisma.exame.findFirst({
      where: { id, deletadoEm: null },
      include: { especialidade: { select: { id: true, nome: true } } },
    });
    if (!exame) {
      throw new NotFoundException('Exame não encontrado.');
    }
    return exame;
  }

  async atualizar(id: string, dto: UpdateExameDto, ctx: AuditContext) {
    const atual = await this.prisma.exame.findFirst({ where: { id, deletadoEm: null } });
    if (!atual) {
      throw new NotFoundException('Exame não encontrado.');
    }

    const atualizado = await this.prisma.exame.update({
      where: { id },
      data: {
        nome: dto.nome ?? atual.nome,
        valorPadrao: dto.valorPadrao ?? atual.valorPadrao,
        ativo: dto.ativo ?? atual.ativo,
        ...(dto.especialidadeId !== undefined ? { especialidadeId: dto.especialidadeId } : {}),
      },
      include: { especialidade: { select: { id: true, nome: true } } },
    });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'ATUALIZACAO',
      entidade: 'Exame',
      entidadeId: id,
      dadosAntigos: this.paraAuditoria(atual),
      dadosNovos: this.paraAuditoria(atualizado),
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });

    return atualizado;
  }

  async remover(id: string, ctx: AuditContext): Promise<void> {
    const atual = await this.prisma.exame.findFirst({ where: { id, deletadoEm: null } });
    if (!atual) {
      throw new NotFoundException('Exame não encontrado.');
    }

    await this.prisma.exame.update({ where: { id }, data: { deletadoEm: new Date(), ativo: false } });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'EXCLUSAO',
      entidade: 'Exame',
      entidadeId: id,
      dadosAntigos: this.paraAuditoria(atual),
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });
  }

  /** Snapshot serializável para audit_logs (Decimal -> string, evita objetos não-JSON). */
  private paraAuditoria(exame: { id: string; nome: string; codigo: string; valorPadrao: { toString(): string }; ativo: boolean; especialidadeId?: string | null }): Record<string, unknown> {
    return {
      id: exame.id,
      nome: exame.nome,
      codigo: exame.codigo,
      valorPadrao: exame.valorPadrao.toString(),
      ativo: exame.ativo,
      especialidadeId: exame.especialidadeId ?? null,
    };
  }
}
