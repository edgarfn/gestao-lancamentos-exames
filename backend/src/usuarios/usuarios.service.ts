import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { Papel, Prisma, Usuario } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuditContext } from '../common/decorators/request-context';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

const INCLUDE_TECNICO = {
  tecnico: { select: { registroProfissional: true } },
} satisfies Prisma.UsuarioInclude;

type UsuarioComTecnico = Prisma.UsuarioGetPayload<{ include: typeof INCLUDE_TECNICO }>;

export interface UsuarioApresentavel {
  id: string;
  nome: string;
  email: string;
  papel: string;
  ativo: boolean;
  ultimoLoginEm: Date | null;
  criadoEm: Date;
  tecnico: { registroProfissional: string | null } | null;
}

/**
 * Gestão de contas de acesso (ADMIN e GESTOR — ver UsuariosController).
 * Senhas são geradas com argon2id e nunca retornadas/registradas em log
 * ou auditoria; apenas o evento (criação/alteração) é auditado.
 * GESTOR nunca vê, cria ou promove usuários com papel ADMIN.
 *
 * Ao criar/alterar para papel TECNICO, um registro Tecnico é vinculado
 * automaticamente — não é necessário cadastrar nos dois lugares.
 */
@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async criar(dto: CreateUsuarioDto, ctx: AuditContext): Promise<UsuarioApresentavel> {
    const existente = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (existente) {
      throw new ConflictException('Já existe um usuário cadastrado com este e-mail.');
    }

    if (ctx.operadorPapel === Papel.GESTOR && dto.papel === Papel.ADMIN) {
      throw new ForbiddenException('Gestores não podem criar contas de administradores.');
    }

    const senhaHash = await argon2.hash(dto.senha, { type: argon2.argon2id });

    const { usuario, tecnico } = await this.prisma.$transaction(async (tx) => {
      const novoUsuario = await tx.usuario.create({
        data: { nome: dto.nome, email: dto.email, papel: dto.papel, senhaHash },
      });
      // Ao criar um usuário com papel TECNICO, já vincula um registro de Técnico
      // para que o operador não precise criar os dois cadastros separadamente.
      const novoTecnico =
        dto.papel === Papel.TECNICO
          ? await tx.tecnico.create({ data: { nome: dto.nome, usuarioId: novoUsuario.id } })
          : null;
      return { usuario: novoUsuario, tecnico: novoTecnico };
    });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'CRIACAO',
      entidade: 'Usuario',
      entidadeId: usuario.id,
      dadosNovos: this.paraAuditoria(usuario),
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });

    if (tecnico) {
      await this.audit.registrar({
        usuarioId: ctx.usuarioId,
        acao: 'CRIACAO',
        entidade: 'Tecnico',
        entidadeId: tecnico.id,
        dadosNovos: { id: tecnico.id, nome: tecnico.nome, usuarioId: tecnico.usuarioId, ativo: tecnico.ativo },
        enderecoIp: ctx.enderecoIp,
        enderecoIpProxy: ctx.enderecoIpProxy,
        userAgent: ctx.userAgent,
      });
    }

    return this.paraApresentacao(usuario);
  }

  async listar(ctx: AuditContext): Promise<UsuarioApresentavel[]> {
    const where = ctx.operadorPapel === Papel.GESTOR ? { papel: { not: Papel.ADMIN } } : {};
    const usuarios = await this.prisma.usuario.findMany({
      where,
      orderBy: { nome: 'asc' },
      include: INCLUDE_TECNICO,
    });
    return usuarios.map((u) => this.paraApresentacao(u));
  }

  async buscarPorId(id: string): Promise<UsuarioApresentavel> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id }, include: INCLUDE_TECNICO });
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return this.paraApresentacao(usuario);
  }

  async atualizar(id: string, dto: UpdateUsuarioDto, ctx: AuditContext): Promise<UsuarioApresentavel> {
    const atual = await this.prisma.usuario.findUnique({ where: { id } });
    if (!atual) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (ctx.operadorPapel === Papel.GESTOR && atual.papel === Papel.ADMIN) {
      throw new ForbiddenException('Gestores não podem modificar contas de administradores.');
    }

    if (ctx.operadorPapel === Papel.GESTOR && dto.papel === Papel.ADMIN) {
      throw new ForbiddenException('Gestores não podem promover usuários para administrador.');
    }

    const desativando = dto.ativo === false && atual.ativo;
    const atualizado = await this.prisma.usuario.update({
      where: { id },
      data: {
        nome: dto.nome ?? atual.nome,
        papel: dto.papel ?? atual.papel,
        ativo: dto.ativo ?? atual.ativo,
        // Ao desativar, revoga sessões ativas imediatamente.
        versaoSessao: desativando ? { increment: 1 } : undefined,
      },
    });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'ATUALIZACAO',
      entidade: 'Usuario',
      entidadeId: id,
      dadosAntigos: this.paraAuditoria(atual),
      dadosNovos: this.paraAuditoria(atualizado),
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });

    // Se o papel mudou para TECNICO e ainda não há Técnico vinculado: criar automaticamente.
    const novoPapel = dto.papel ?? atual.papel;
    if (novoPapel === Papel.TECNICO && atual.papel !== Papel.TECNICO) {
      const tecnicoExistente = await this.prisma.tecnico.findUnique({ where: { usuarioId: id } });
      if (!tecnicoExistente) {
        const novoTecnico = await this.prisma.tecnico.create({
          data: { nome: atualizado.nome, usuarioId: id },
        });
        await this.audit.registrar({
          usuarioId: ctx.usuarioId,
          acao: 'CRIACAO',
          entidade: 'Tecnico',
          entidadeId: novoTecnico.id,
          dadosNovos: { id: novoTecnico.id, nome: novoTecnico.nome, usuarioId: id, ativo: true },
          enderecoIp: ctx.enderecoIp,
          enderecoIpProxy: ctx.enderecoIpProxy,
          userAgent: ctx.userAgent,
        });
      }
    }

    // Sincroniza registroProfissional no Técnico vinculado quando informado
    if (dto.registroProfissional !== undefined && novoPapel === Papel.TECNICO) {
      await this.prisma.tecnico.updateMany({
        where: { usuarioId: id, deletadoEm: null },
        data: { registroProfissional: dto.registroProfissional || null },
      });
    }

    // Sincroniza o nome do Técnico vinculado quando o nome do usuário muda
    if (dto.nome && dto.nome !== atual.nome && novoPapel === Papel.TECNICO) {
      await this.prisma.tecnico.updateMany({
        where: { usuarioId: id, deletadoEm: null },
        data: { nome: atualizado.nome },
      });
    }

    const comRelacoes = await this.prisma.usuario.findUnique({ where: { id }, include: INCLUDE_TECNICO });
    return this.paraApresentacao(comRelacoes!);
  }

  /** Gera uma nova senha temporária aleatória e força a revogação das sessões ativas. */
  async redefinirSenha(id: string, ctx: AuditContext): Promise<{ senhaTemporaria: string }> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (ctx.operadorPapel === Papel.GESTOR && usuario.papel === Papel.ADMIN) {
      throw new ForbiddenException('Gestores não podem redefinir a senha de administradores.');
    }

    const senhaTemporaria = randomBytes(18).toString('base64url');
    const senhaHash = await argon2.hash(senhaTemporaria, { type: argon2.argon2id });

    await this.prisma.usuario.update({
      where: { id },
      data: { senhaHash, versaoSessao: { increment: 1 } },
    });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'ATUALIZACAO',
      entidade: 'Usuario',
      entidadeId: id,
      dadosNovos: { evento: 'redefinicao_de_senha_pelo_administrador' },
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });

    return { senhaTemporaria };
  }

  private paraApresentacao(usuario: Usuario | UsuarioComTecnico): UsuarioApresentavel {
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      ativo: usuario.ativo,
      ultimoLoginEm: usuario.ultimoLoginEm,
      criadoEm: usuario.criadoEm,
      tecnico: 'tecnico' in usuario ? (usuario as UsuarioComTecnico).tecnico : null,
    };
  }

  private paraAuditoria(usuario: Usuario): Record<string, unknown> {
    return { id: usuario.id, nome: usuario.nome, papel: usuario.papel, ativo: usuario.ativo };
  }
}
