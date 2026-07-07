import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Tecnico } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { AuditService } from '../common/audit/audit.service';
import { AuditContext } from '../common/decorators/request-context';
import { paginar, ResultadoPaginado } from '../common/dto/pagination-query.dto';
import { CreateTecnicoDto } from './dto/create-tecnico.dto';
import { UpdateTecnicoDto } from './dto/update-tecnico.dto';
import { QueryTecnicoDto } from './dto/query-tecnico.dto';

export interface TecnicoApresentavel {
  id: string;
  nome: string;
  registroProfissional: string | null;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
}

/**
 * Camada de serviço para o cadastro de Técnicos.
 *
 * Privacy by design: o CPF nunca é persistido em texto claro — é cifrado
 * (CryptoService.encrypt) para armazenamento e indexado via hash determinístico
 * (CryptoService.searchHash) para permitir busca exata e checagem de duplicidade
 * sem decifrar registros existentes. As respostas da API nunca incluem o CPF
 * decifrado (ver `paraApresentacao`), reduzindo a superfície de exposição —
 * apenas relatórios específicos com necessidade legítima decifrariam o dado.
 */
@Injectable()
export class TecnicosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  async criar(dto: CreateTecnicoDto, ctx: AuditContext): Promise<TecnicoApresentavel> {
    let documentoCifrado: string | null = null;
    let documentoHash: string | null = null;

    if (dto.documento) {
      documentoHash = this.crypto.searchHash(dto.documento);
      const existente = await this.prisma.tecnico.findUnique({ where: { documentoHash } });
      if (existente) {
        throw new ConflictException('Já existe um técnico cadastrado com este documento.');
      }
      documentoCifrado = this.crypto.encrypt(dto.documento);
    }

    const tecnico = await this.prisma.tecnico.create({
      data: {
        nome: dto.nome,
        documentoCifrado,
        documentoHash,
        registroProfissional: dto.registroProfissional ?? null,
        ativo: dto.ativo ?? true,
      },
    });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'CRIACAO',
      entidade: 'Tecnico',
      entidadeId: tecnico.id,
      dadosNovos: this.paraAuditoria(tecnico),
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });

    return this.paraApresentacao(tecnico);
  }

  async listar(query: QueryTecnicoDto): Promise<ResultadoPaginado<TecnicoApresentavel>> {
    const where: Prisma.TecnicoWhereInput = {
      deletadoEm: null,
      ...(query.nome ? { nome: { contains: query.nome, mode: 'insensitive' } } : {}),
      ...(query.ativo !== undefined ? { ativo: query.ativo === 'true' } : {}),
    };

    const [itens, total] = await this.prisma.$transaction([
      this.prisma.tecnico.findMany({
        where,
        orderBy: { nome: 'asc' },
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.tecnico.count({ where }),
    ]);

    return paginar(
      itens.map((t) => this.paraApresentacao(t)),
      total,
      query.pagina,
      query.tamanhoPagina,
    );
  }

  async buscarPorId(id: string): Promise<TecnicoApresentavel> {
    const tecnico = await this.prisma.tecnico.findFirst({ where: { id, deletadoEm: null } });
    if (!tecnico) {
      throw new NotFoundException('Técnico não encontrado.');
    }
    return this.paraApresentacao(tecnico);
  }

  async atualizar(id: string, dto: UpdateTecnicoDto, ctx: AuditContext): Promise<TecnicoApresentavel> {
    const atual = await this.prisma.tecnico.findFirst({ where: { id, deletadoEm: null } });
    if (!atual) {
      throw new NotFoundException('Técnico não encontrado.');
    }

    const atualizado = await this.prisma.tecnico.update({
      where: { id },
      data: {
        nome: dto.nome ?? atual.nome,
        registroProfissional: dto.registroProfissional ?? atual.registroProfissional,
        ativo: dto.ativo ?? atual.ativo,
      },
    });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'ATUALIZACAO',
      entidade: 'Tecnico',
      entidadeId: id,
      dadosAntigos: this.paraAuditoria(atual),
      dadosNovos: this.paraAuditoria(atualizado),
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });

    return this.paraApresentacao(atualizado);
  }

  async remover(id: string, ctx: AuditContext): Promise<void> {
    const atual = await this.prisma.tecnico.findFirst({ where: { id, deletadoEm: null } });
    if (!atual) {
      throw new NotFoundException('Técnico não encontrado.');
    }

    // Soft delete: preserva o histórico de lançamentos vinculados e permite
    // auditoria/retenção controlada — exclusão física não é realizada aqui.
    await this.prisma.tecnico.update({ where: { id }, data: { deletadoEm: new Date(), ativo: false } });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'EXCLUSAO',
      entidade: 'Tecnico',
      entidadeId: id,
      dadosAntigos: this.paraAuditoria(atual),
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });
  }

  private paraApresentacao(tecnico: Tecnico): TecnicoApresentavel {
    return {
      id: tecnico.id,
      nome: tecnico.nome,
      registroProfissional: tecnico.registroProfissional,
      ativo: tecnico.ativo,
      criadoEm: tecnico.criadoEm,
      atualizadoEm: tecnico.atualizadoEm,
    };
  }

  /** Snapshot seguro para gravação em audit_logs — nunca inclui dados cifrados/pessoais. */
  private paraAuditoria(tecnico: Tecnico): Record<string, unknown> {
    return {
      id: tecnico.id,
      nome: tecnico.nome,
      registroProfissional: tecnico.registroProfissional,
      ativo: tecnico.ativo,
    };
  }
}
