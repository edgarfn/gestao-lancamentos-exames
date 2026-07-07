import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';

function criarUsuarioPrisma(parcial: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    nome: 'Admin Um',
    email: 'admin@clinica.com',
    papel: 'ADMIN',
    senhaHash: 'hash-anterior',
    ativo: true,
    versaoSessao: 1,
    ultimoLoginEm: null,
    criadoEm: new Date('2026-01-01T00:00:00.000Z'),
    atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
    ...parcial,
  };
}

function criarTecnicoPrisma(parcial: Record<string, unknown> = {}) {
  return {
    id: 'tecnico-1',
    nome: 'Técnico Um',
    documentoCifrado: null,
    documentoHash: null,
    registroProfissional: null,
    ativo: true,
    usuarioId: 'user-1',
    criadoEm: new Date('2026-01-01T00:00:00.000Z'),
    atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
    deletadoEm: null,
    ...parcial,
  };
}

describe('UsuariosService', () => {
  let prisma: {
    $transaction: jest.Mock;
    usuario: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock };
    tecnico: { create: jest.Mock; findUnique: jest.Mock; updateMany: jest.Mock };
  };
  let audit: { registrar: jest.Mock };
  let service: UsuariosService;

  const ctx = { usuarioId: 'admin-1', operadorPapel: 'ADMIN' as const, enderecoIp: '127.0.0.1', enderecoIpProxy: null, userAgent: 'jest' };
  const ctxGestor = { usuarioId: 'gestor-1', operadorPapel: 'GESTOR' as const, enderecoIp: '127.0.0.1', enderecoIpProxy: null, userAgent: 'jest' };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma)),
      usuario: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      tecnico: { create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    audit = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new UsuariosService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  });

  describe('listar', () => {
    it('ADMIN recebe todos os usuários sem filtro de papel', async () => {
      prisma.usuario.findMany.mockResolvedValue([
        criarUsuarioPrisma({ papel: 'ADMIN' }),
        criarUsuarioPrisma({ id: 'user-2', papel: 'GESTOR' }),
      ]);

      const resultado = await service.listar(ctx);

      expect(prisma.usuario.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
      expect(resultado).toHaveLength(2);
    });

    it('GESTOR não recebe usuários com papel ADMIN', async () => {
      prisma.usuario.findMany.mockResolvedValue([
        criarUsuarioPrisma({ id: 'user-2', papel: 'GESTOR' }),
      ]);

      await service.listar(ctxGestor);

      expect(prisma.usuario.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { papel: { not: 'ADMIN' } } }),
      );
    });
  });

  describe('criar', () => {
    it('rejeita e-mail já cadastrado', async () => {
      prisma.usuario.findUnique.mockResolvedValue(criarUsuarioPrisma());

      await expect(
        service.criar(
          { nome: 'Outro', email: 'admin@clinica.com', senha: 'Senha-Forte123!', papel: 'GESTOR' as never },
          ctx,
        ),
      ).rejects.toThrow(ConflictException);
      expect(prisma.usuario.create).not.toHaveBeenCalled();
    });

    it('lança ForbiddenException quando GESTOR tenta criar usuário ADMIN', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      await expect(
        service.criar(
          { nome: 'Admin Novo', email: 'novo@clinica.com', senha: 'Senha-Forte123!', papel: 'ADMIN' as never },
          ctxGestor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.usuario.create).not.toHaveBeenCalled();
    });

    it('gera hash argon2id da senha e nunca a expõe na resposta nem na auditoria', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.create.mockResolvedValue(
        criarUsuarioPrisma({ id: 'user-2', email: 'novo@clinica.com', papel: 'ADMIN' }),
      );

      const resultado = await service.criar(
        {
          nome: 'Novo Usuário',
          email: 'novo@clinica.com',
          senha: 'Senha-Forte123!',
          papel: 'ADMIN' as never,
        },
        ctx,
      );

      const dadosPersistidos = prisma.usuario.create.mock.calls[0][0].data;
      expect(dadosPersistidos.senhaHash).toMatch(/^\$argon2id\$/);
      expect(dadosPersistidos.senhaHash).not.toContain('Senha-Forte123!');
      expect(resultado).not.toHaveProperty('senha');
      expect(resultado).not.toHaveProperty('senhaHash');
      expect(JSON.stringify(audit.registrar.mock.calls[0][0].dadosNovos)).not.toContain('Senha-Forte123!');
    });

    it('cria Técnico vinculado automaticamente quando papel é TECNICO', async () => {
      const usuarioCriado = criarUsuarioPrisma({ id: 'user-3', papel: 'TECNICO', nome: 'Técnico Novo' });
      const tecnicoCriado = criarTecnicoPrisma({ id: 'tecnico-novo', nome: 'Técnico Novo', usuarioId: 'user-3' });

      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.create.mockResolvedValue(usuarioCriado);
      prisma.tecnico.create.mockResolvedValue(tecnicoCriado);

      await service.criar(
        { nome: 'Técnico Novo', email: 'tecnico@clinica.com', senha: 'Senha-Forte123!', papel: 'TECNICO' as never },
        ctx,
      );

      expect(prisma.tecnico.create).toHaveBeenCalledWith({
        data: { nome: 'Técnico Novo', usuarioId: 'user-3' },
      });
      // Deve haver duas entradas de auditoria: uma para Usuario, uma para Tecnico
      const entradasAuditoria = audit.registrar.mock.calls.map((c) => (c[0] as { entidade?: string }).entidade);
      expect(entradasAuditoria).toContain('Usuario');
      expect(entradasAuditoria).toContain('Tecnico');
    });

    it('NÃO cria Técnico quando papel é ADMIN ou GESTOR', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.create.mockResolvedValue(criarUsuarioPrisma({ papel: 'GESTOR' }));

      await service.criar(
        { nome: 'Gestor Um', email: 'gestor@clinica.com', senha: 'Senha-Forte123!', papel: 'GESTOR' as never },
        ctx,
      );

      expect(prisma.tecnico.create).not.toHaveBeenCalled();
    });
  });

  describe('atualizar', () => {
    it('lança NotFoundException quando o usuário não existe', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      await expect(service.atualizar('id-x', { ativo: false }, ctx)).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException quando GESTOR tenta promover usuário para ADMIN', async () => {
      prisma.usuario.findUnique.mockResolvedValue(criarUsuarioPrisma({ papel: 'GESTOR' }));

      await expect(
        service.atualizar('user-1', { papel: 'ADMIN' as never }, ctxGestor),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('lança ForbiddenException quando GESTOR tenta editar um ADMIN', async () => {
      prisma.usuario.findUnique.mockResolvedValue(criarUsuarioPrisma({ papel: 'ADMIN' }));

      await expect(
        service.atualizar('user-1', { nome: 'Novo Nome' }, ctxGestor),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('permite GESTOR editar GESTOR ou TECNICO', async () => {
      prisma.usuario.findUnique.mockResolvedValue(criarUsuarioPrisma({ papel: 'GESTOR' }));
      prisma.usuario.update.mockResolvedValue(criarUsuarioPrisma({ papel: 'GESTOR', nome: 'Gestor Editado' }));

      await expect(service.atualizar('user-1', { nome: 'Gestor Editado' }, ctxGestor)).resolves.not.toThrow();
      expect(prisma.usuario.update).toHaveBeenCalled();
    });

    it('ao desativar um usuário ativo, incrementa a versão de sessão (revogação imediata)', async () => {
      prisma.usuario.findUnique.mockResolvedValue(criarUsuarioPrisma({ ativo: true }));
      prisma.usuario.update.mockResolvedValue(criarUsuarioPrisma({ ativo: false }));

      await service.atualizar('user-1', { ativo: false }, ctx);

      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { nome: 'Admin Um', papel: 'ADMIN', ativo: false, versaoSessao: { increment: 1 } },
      });
    });

    it('não incrementa a versão de sessão quando o usuário continua ativo', async () => {
      prisma.usuario.findUnique.mockResolvedValue(criarUsuarioPrisma({ ativo: true }));
      prisma.usuario.update.mockResolvedValue(criarUsuarioPrisma());

      await service.atualizar('user-1', { nome: 'Admin Renomeado' }, ctx);

      expect(prisma.usuario.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { nome: 'Admin Renomeado', papel: 'ADMIN', ativo: true, versaoSessao: undefined },
      });
    });

    it('cria Técnico vinculado ao promover papel para TECNICO', async () => {
      const usuarioGestor = criarUsuarioPrisma({ papel: 'GESTOR', nome: 'Gestor Promovido' });
      const usuarioAtualizado = criarUsuarioPrisma({ papel: 'TECNICO', nome: 'Gestor Promovido' });
      const tecnicoCriado = criarTecnicoPrisma({ nome: 'Gestor Promovido', usuarioId: 'user-1' });

      prisma.usuario.findUnique.mockResolvedValue(usuarioGestor);
      prisma.usuario.update.mockResolvedValue(usuarioAtualizado);
      prisma.tecnico.findUnique.mockResolvedValue(null);
      prisma.tecnico.create.mockResolvedValue(tecnicoCriado);

      await service.atualizar('user-1', { papel: 'TECNICO' as never }, ctx);

      expect(prisma.tecnico.findUnique).toHaveBeenCalledWith({ where: { usuarioId: 'user-1' } });
      expect(prisma.tecnico.create).toHaveBeenCalledWith({
        data: { nome: 'Gestor Promovido', usuarioId: 'user-1' },
      });
      const entradasAuditoria = audit.registrar.mock.calls.map((c) => (c[0] as { entidade?: string }).entidade);
      expect(entradasAuditoria).toContain('Tecnico');
    });

    it('NÃO cria Técnico duplicado se o usuário já tem um Técnico vinculado', async () => {
      const usuarioGestor = criarUsuarioPrisma({ papel: 'GESTOR' });
      const usuarioAtualizado = criarUsuarioPrisma({ papel: 'TECNICO' });

      prisma.usuario.findUnique.mockResolvedValue(usuarioGestor);
      prisma.usuario.update.mockResolvedValue(usuarioAtualizado);
      prisma.tecnico.findUnique.mockResolvedValue(criarTecnicoPrisma());

      await service.atualizar('user-1', { papel: 'TECNICO' as never }, ctx);

      expect(prisma.tecnico.create).not.toHaveBeenCalled();
    });

    it('NÃO cria Técnico ao alterar nome/status sem mudar papel para TECNICO', async () => {
      prisma.usuario.findUnique.mockResolvedValue(criarUsuarioPrisma({ papel: 'ADMIN' }));
      prisma.usuario.update.mockResolvedValue(criarUsuarioPrisma({ nome: 'Novo Nome' }));

      await service.atualizar('user-1', { nome: 'Novo Nome' }, ctx);

      expect(prisma.tecnico.create).not.toHaveBeenCalled();
    });
  });

  describe('redefinirSenha', () => {
    it('gera senha temporária aleatória, incrementa versaoSessao e nunca registra a senha em auditoria', async () => {
      prisma.usuario.findUnique.mockResolvedValue(criarUsuarioPrisma());
      prisma.usuario.update.mockResolvedValue({});

      const resultado1 = await service.redefinirSenha('user-1', ctx);
      const resultado2 = await service.redefinirSenha('user-1', ctx);

      expect(resultado1.senhaTemporaria).not.toEqual(resultado2.senhaTemporaria);
      expect(resultado1.senhaTemporaria.length).toBeGreaterThan(16);

      const dataAtualizacao = prisma.usuario.update.mock.calls[0][0].data;
      expect(dataAtualizacao.senhaHash).toMatch(/^\$argon2id\$/);
      expect(dataAtualizacao.versaoSessao).toEqual({ increment: 1 });

      for (const chamada of audit.registrar.mock.calls) {
        expect(JSON.stringify(chamada[0])).not.toContain(resultado1.senhaTemporaria);
        expect(JSON.stringify(chamada[0])).not.toContain(resultado2.senhaTemporaria);
      }
    });

    it('lança NotFoundException para usuário inexistente', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      await expect(service.redefinirSenha('id-x', ctx)).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException quando GESTOR tenta redefinir senha de ADMIN', async () => {
      prisma.usuario.findUnique.mockResolvedValue(criarUsuarioPrisma({ papel: 'ADMIN' }));

      await expect(service.redefinirSenha('user-1', ctxGestor)).rejects.toThrow(ForbiddenException);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });
  });
});
