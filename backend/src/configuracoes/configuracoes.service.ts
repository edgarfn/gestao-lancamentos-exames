import {
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { AuditService } from '../common/audit/audit.service';
import type { AuditContext } from '../common/decorators/request-context';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateConfiguracaoDto } from './dto/update-configuracao.dto';

const SINGLETON_ID = 'singleton';
const EXTENSOES_LOGO_PERMITIDAS = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

export interface ConfiguracaoApresentavel {
  nomeClinica: string | null;
  cnpj: string | null;
  endereco: string | null;
  telefone: string | null;
  emailContato: string | null;
  temLogo: boolean;
  mensagemBemVindo: string | null;
}

/**
 * Configurações da clínica — modelo singleton (único registro no banco).
 * Persiste nome, dados de contato, logotipo e mensagem de boas-vindas.
 * O logotipo é armazenado em disco (CONFIGURACOES_DIR) e servido via stream.
 */
@Injectable()
export class ConfiguracoesService {
  private readonly logger = new Logger(ConfiguracoesService.name);
  private readonly diretorio: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    this.diretorio = this.config.get<string>('CONFIGURACOES_DIR', '/var/uploads/configuracoes');
  }

  async obter(): Promise<ConfiguracaoApresentavel> {
    const cfg = await this.prisma.configuracao.findUnique({ where: { id: SINGLETON_ID } });
    return this.paraApresentacao(cfg);
  }

  async atualizar(dto: UpdateConfiguracaoDto, ctx: AuditContext): Promise<ConfiguracaoApresentavel> {
    const anterior = await this.prisma.configuracao.findUnique({ where: { id: SINGLETON_ID } });

    const atualizado = await this.prisma.configuracao.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        nomeClinica: dto.nomeClinica,
        cnpj: dto.cnpj,
        endereco: dto.endereco,
        telefone: dto.telefone,
        emailContato: dto.emailContato,
        mensagemBemVindo: dto.mensagemBemVindo,
      },
      update: {
        nomeClinica: dto.nomeClinica,
        cnpj: dto.cnpj,
        endereco: dto.endereco,
        telefone: dto.telefone,
        emailContato: dto.emailContato,
        mensagemBemVindo: dto.mensagemBemVindo,
      },
    });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'ATUALIZACAO',
      entidade: 'Configuracao',
      entidadeId: SINGLETON_ID,
      dadosAntigos: anterior
        ? { nomeClinica: anterior.nomeClinica, cnpj: anterior.cnpj, endereco: anterior.endereco,
            telefone: anterior.telefone, emailContato: anterior.emailContato,
            mensagemBemVindo: anterior.mensagemBemVindo }
        : null,
      dadosNovos: { nomeClinica: atualizado.nomeClinica, cnpj: atualizado.cnpj,
                    endereco: atualizado.endereco, telefone: atualizado.telefone,
                    emailContato: atualizado.emailContato,
                    mensagemBemVindo: atualizado.mensagemBemVindo },
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });

    this.logger.log('Configurações da clínica atualizadas.');
    return this.paraApresentacao(atualizado);
  }

  async salvarLogo(buffer: Buffer, nomeOriginal: string, ctx: AuditContext): Promise<ConfiguracaoApresentavel> {
    const ext = extname(nomeOriginal).toLowerCase();
    if (!EXTENSOES_LOGO_PERMITIDAS.includes(ext)) {
      throw new UnsupportedMediaTypeException(
        `Formato de imagem não suportado. Use: ${EXTENSOES_LOGO_PERMITIDAS.join(', ')}`,
      );
    }

    await mkdir(this.diretorio, { recursive: true });

    const nomeArquivo = `logo${ext}`;
    const caminho = join(this.diretorio, nomeArquivo);

    // Remove logo anterior de extensão diferente, se existir
    const cfgAtual = await this.prisma.configuracao.findUnique({ where: { id: SINGLETON_ID } });
    if (cfgAtual?.logoNome && cfgAtual.logoNome !== nomeArquivo) {
      try {
        await unlink(join(this.diretorio, cfgAtual.logoNome));
      } catch {
        // Ignorado — arquivo pode já não existir
      }
    }

    await writeFile(caminho, buffer);

    const atualizado = await this.prisma.configuracao.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, logoNome: nomeArquivo },
      update: { logoNome: nomeArquivo },
    });

    await this.audit.registrar({
      usuarioId: ctx.usuarioId,
      acao: 'ATUALIZACAO',
      entidade: 'Configuracao',
      entidadeId: SINGLETON_ID,
      dadosNovos: { logoNome: nomeArquivo },
      enderecoIp: ctx.enderecoIp,
      enderecoIpProxy: ctx.enderecoIpProxy,
      userAgent: ctx.userAgent,
    });

    this.logger.log(`Logotipo da clínica atualizado: ${nomeArquivo}`);
    return this.paraApresentacao(atualizado);
  }

  async obterPublica(): Promise<{ nomeClinica: string | null; logoBase64: string | null }> {
    const cfg = await this.prisma.configuracao.findUnique({ where: { id: SINGLETON_ID } });
    let logoBase64: string | null = null;
    if (cfg?.logoNome) {
      try {
        const buf = await readFile(join(this.diretorio, cfg.logoNome));
        const ext = extname(cfg.logoNome).toLowerCase().replace('.', '');
        const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        logoBase64 = `data:${mime};base64,${buf.toString('base64')}`;
      } catch { /* sem logo */ }
    }
    return { nomeClinica: cfg?.nomeClinica ?? null, logoBase64 };
  }

  async obterParaPdf(): Promise<{
    nomeClinica: string | null;
    cnpj: string | null;
    endereco: string | null;
    telefone: string | null;
    emailContato: string | null;
    logoBuffer: Buffer | null;
  }> {
    const cfg = await this.prisma.configuracao.findUnique({ where: { id: SINGLETON_ID } });
    let logoBuffer: Buffer | null = null;
    if (cfg?.logoNome) {
      const ext = extname(cfg.logoNome).toLowerCase();
      if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        try { logoBuffer = await readFile(join(this.diretorio, cfg.logoNome)); } catch { /* ok */ }
      }
    }
    return {
      nomeClinica: cfg?.nomeClinica ?? null,
      cnpj: cfg?.cnpj ?? null,
      endereco: cfg?.endereco ?? null,
      telefone: cfg?.telefone ?? null,
      emailContato: cfg?.emailContato ?? null,
      logoBuffer,
    };
  }

  async obterLogo(): Promise<{ stream: StreamableFile; contentType: string }> {
    const cfg = await this.prisma.configuracao.findUnique({ where: { id: SINGLETON_ID } });
    if (!cfg?.logoNome) {
      throw new NotFoundException('Nenhum logotipo configurado.');
    }

    const caminho = join(this.diretorio, cfg.logoNome);
    const ext = extname(cfg.logoNome).toLowerCase();

    try {
      const stream = new StreamableFile(createReadStream(caminho));
      return { stream, contentType: CONTENT_TYPES[ext] ?? 'application/octet-stream' };
    } catch {
      throw new NotFoundException('Arquivo de logotipo não encontrado.');
    }
  }

  private paraApresentacao(cfg: { nomeClinica?: string | null; cnpj?: string | null;
    endereco?: string | null; telefone?: string | null; emailContato?: string | null;
    logoNome?: string | null; mensagemBemVindo?: string | null } | null): ConfiguracaoApresentavel {
    return {
      nomeClinica: cfg?.nomeClinica ?? null,
      cnpj: cfg?.cnpj ?? null,
      endereco: cfg?.endereco ?? null,
      telefone: cfg?.telefone ?? null,
      emailContato: cfg?.emailContato ?? null,
      temLogo: !!cfg?.logoNome,
      mensagemBemVindo: cfg?.mensagemBemVindo ?? null,
    };
  }
}
