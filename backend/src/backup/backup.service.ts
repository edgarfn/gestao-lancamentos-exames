import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { execFile } from 'child_process';
import { createReadStream } from 'fs';
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'fs/promises';
import { basename, join } from 'path';
import { promisify } from 'util';
import { AuditService } from '../common/audit/audit.service';
import type { AuditContext } from '../common/decorators/request-context';

const execFileAsync = promisify(execFile);

// Nome gerado exclusivamente por este sistema: "backup-AAAA-MM-DDTHH-mm-ss.dump"
// ou "backup-AAAA-MM-DDTHH-mm-ss.dump.enc" para versões criptografadas.
// Validado estritamente em toda operação que recebe nome vindo do cliente
// para impedir ataques de path traversal.
const NOME_ARQUIVO_REGEX = /^backup-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})\.(dump|dump\.enc)$/;

// Identifica backups criptografados: primeiros 4 bytes do arquivo .enc.
const MAGIC = Buffer.from('BKUP');

const SEM_CONTEXTO: AuditContext = { usuarioId: null, enderecoIp: null, enderecoIpProxy: null, userAgent: null };

export interface BackupArquivo {
  nome: string;
  tamanhoBytes: number;
  criadoEm: Date;
  criptografado: boolean;
}

/**
 * Backup e restauração do banco de dados via pg_dump/pg_restore.
 *
 * Decisões de design relevantes:
 * - Formato `--format=custom` do pg_dump: binário, compactado e compatível
 *   com restauração seletiva/paralela — recomendado pelo PostgreSQL.
 * - `execFile` com argumentos em array: elimina risco de injeção de comandos.
 * - Sem modelo Prisma para metadados: listagem via diretório evita o problema
 *   "ovo e galinha" — uma restauração reverteria a tabela de metadados.
 * - Criptografia opcional (AES-256-GCM): gera arquivo `.dump.enc` com
 *   magic "BKUP" + IV (12 bytes) + auth tag (16 bytes) + ciphertext.
 *   Detectada automaticamente na restauração pela extensão `.enc`.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly diretorio: string;
  private readonly databaseUrl: string;
  private readonly retencaoDias: number;

  constructor(
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    this.diretorio = this.config.get<string>('BACKUP_DIR', '/var/backups/exames');
    // Remove query params Prisma (?schema=public) não reconhecidos pelo libpq.
    const rawDatabaseUrl = this.config.getOrThrow<string>('DATABASE_URL');
    const parsedUrl = new URL(rawDatabaseUrl);
    parsedUrl.search = '';
    this.databaseUrl = parsedUrl.toString();
    this.retencaoDias = this.config.get<number>('BACKUP_RETENTION_DIAS', 30);
  }

  async criar(contexto: AuditContext, criptografar = false): Promise<BackupArquivo> {
    await mkdir(this.diretorio, { recursive: true });

    const agora = new Date();
    const nomeDump = `backup-${this.paraNomeDeArquivo(agora)}.dump`;
    const caminhoTemp = join(this.diretorio, nomeDump);

    try {
      await execFileAsync('pg_dump', [
        '--format=custom',
        '--no-owner',
        `--file=${caminhoTemp}`,
        this.databaseUrl,
      ]);
    } catch (error) {
      await this.removerSeExistir(caminhoTemp);
      this.logger.error(`Falha ao gerar backup: ${(error as Error).message}`);
      throw new InternalServerErrorException('Não foi possível gerar o backup do banco de dados.');
    }

    let nomeArquivo = nomeDump;
    let caminho = caminhoTemp;

    if (criptografar) {
      nomeArquivo = `${nomeDump}.enc`;
      caminho = join(this.diretorio, nomeArquivo);
      await this.criptografarArquivo(caminhoTemp, caminho);
      await this.removerSeExistir(caminhoTemp);
    }

    const info = await stat(caminho);

    await this.audit.registrar({
      ...contexto,
      acao: 'BACKUP_CRIACAO',
      entidade: 'Backup',
      entidadeId: nomeArquivo,
      dadosNovos: { nome: nomeArquivo, tamanhoBytes: info.size, criptografado: criptografar },
    });

    this.logger.log(`Backup criado: ${nomeArquivo} (${info.size} bytes)${criptografar ? ' [criptografado]' : ''}`);
    return { nome: nomeArquivo, tamanhoBytes: info.size, criadoEm: this.dataDoNome(nomeArquivo) ?? agora, criptografado: criptografar };
  }

  async listar(): Promise<BackupArquivo[]> {
    await mkdir(this.diretorio, { recursive: true });
    const arquivos = await readdir(this.diretorio);

    const itens = await Promise.all(
      arquivos
        .filter((nome) => NOME_ARQUIVO_REGEX.test(nome))
        .map(async (nome) => {
          const info = await stat(join(this.diretorio, nome));
          return {
            nome,
            tamanhoBytes: info.size,
            criadoEm: this.dataDoNome(nome) ?? info.mtime,
            criptografado: nome.endsWith('.enc'),
          };
        }),
    );

    return itens.sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());
  }

  async baixar(nome: string): Promise<StreamableFile> {
    const caminho = this.resolverCaminhoSeguro(nome);

    try {
      await stat(caminho);
    } catch {
      throw new NotFoundException('Arquivo de backup não encontrado.');
    }

    return new StreamableFile(createReadStream(caminho));
  }

  async remover(nome: string, contexto: AuditContext): Promise<void> {
    const caminho = this.resolverCaminhoSeguro(nome);

    try {
      await unlink(caminho);
    } catch {
      throw new NotFoundException('Arquivo de backup não encontrado.');
    }

    await this.audit.registrar({
      ...contexto,
      acao: 'BACKUP_EXCLUSAO',
      entidade: 'Backup',
      entidadeId: nome,
      dadosNovos: { nome },
    });

    this.logger.warn(`Arquivo de backup removido manualmente: ${nome}`);
  }

  /**
   * Restaura o banco a partir de um arquivo enviado pelo cliente. Se o arquivo
   * for `.dump.enc`, descriptografa para um arquivo temporário antes de chamar
   * o pg_restore. Ambos os arquivos temporários são removidos ao final.
   */
  async restaurar(caminhoTemporario: string, nomeOriginal: string, contexto: AuditContext): Promise<void> {
    let caminhoParaRestaurar = caminhoTemporario;
    let caminhoDecriptado: string | null = null;

    if (nomeOriginal.endsWith('.dump.enc')) {
      caminhoDecriptado = `${caminhoTemporario}.decrypted.dump`;
      await this.descriptografarArquivo(caminhoTemporario, caminhoDecriptado);
      caminhoParaRestaurar = caminhoDecriptado;
    }

    try {
      // --clean --if-exists: remove objetos existentes antes de recriá-los.
      // --no-owner: evita falhas por diferenças de roles entre ambientes.
      await execFileAsync('pg_restore', [
        '--clean',
        '--if-exists',
        '--no-owner',
        `--dbname=${this.databaseUrl}`,
        caminhoParaRestaurar,
      ]);
    } catch (error) {
      this.logger.error(`Falha ao restaurar backup "${nomeOriginal}": ${(error as Error).message}`);
      throw new InternalServerErrorException(
        'Não foi possível restaurar o backup. Verifique se o arquivo enviado é um backup válido (.dump ou .dump.enc) gerado por este sistema.',
      );
    } finally {
      await this.removerSeExistir(caminhoTemporario);
      if (caminhoDecriptado) await this.removerSeExistir(caminhoDecriptado);
    }

    await this.audit.registrar({
      ...contexto,
      acao: 'BACKUP_RESTAURACAO',
      entidade: 'Backup',
      entidadeId: nomeOriginal,
      dadosNovos: { nomeArquivoEnviado: nomeOriginal },
    });

    this.logger.warn(
      `Banco de dados restaurado a partir de "${nomeOriginal}" — todo o conteúdo anterior ao backup foi substituído.`,
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async executarBackupProgramado(): Promise<void> {
    try {
      const arquivo = await this.criar(SEM_CONTEXTO);
      this.logger.log(`Backup automático concluído: ${arquivo.nome}`);
    } catch (error) {
      this.logger.error(`Backup automático falhou: ${(error as Error).message}`);
      return;
    }

    await this.removerBackupsExpirados();
  }

  private async criptografarArquivo(caminhoEntrada: string, caminhoSaida: string): Promise<void> {
    const conteudo = await readFile(caminhoEntrada);
    const iv = randomBytes(12);
    const chave = this.derivarChave();
    const cipher = createCipheriv('aes-256-gcm', chave, iv);
    const cifrado = Buffer.concat([cipher.update(conteudo), cipher.final()]);
    const authTag = cipher.getAuthTag();
    await writeFile(caminhoSaida, Buffer.concat([MAGIC, iv, authTag, cifrado]));
  }

  private async descriptografarArquivo(caminhoEntrada: string, caminhoSaida: string): Promise<void> {
    const dados = await readFile(caminhoEntrada);
    if (dados.length < 32 || !dados.subarray(0, 4).equals(MAGIC)) {
      throw new BadRequestException('Arquivo não é um backup criptografado válido (magic bytes ausentes).');
    }
    const iv = dados.subarray(4, 16);
    const authTag = dados.subarray(16, 32);
    const cifrado = dados.subarray(32);
    const chave = this.derivarChave();
    const decipher = createDecipheriv('aes-256-gcm', chave, iv);
    decipher.setAuthTag(authTag);
    try {
      const decifrado = Buffer.concat([decipher.update(cifrado), decipher.final()]);
      await writeFile(caminhoSaida, decifrado);
    } catch {
      throw new BadRequestException('Falha ao descriptografar o backup — verifique se a chave de cifragem do servidor é a mesma utilizada na criação.');
    }
  }

  private derivarChave(): Buffer {
    const raw = this.config.getOrThrow<string>('DATA_ENCRYPTION_KEY');
    return createHash('sha256').update(raw).digest().subarray(0, 32);
  }

  private async removerBackupsExpirados(): Promise<void> {
    const limite = new Date();
    limite.setDate(limite.getDate() - this.retencaoDias);

    const backups = await this.listar();
    const expirados = backups.filter((item) => item.criadoEm < limite);

    for (const item of expirados) {
      await this.removerSeExistir(join(this.diretorio, item.nome));
      this.logger.log(
        `Backup expirado removido pela política de retenção (${this.retencaoDias} dias): ${item.nome}`,
      );
    }
  }

  private async removerSeExistir(caminho: string): Promise<void> {
    try {
      await unlink(caminho);
    } catch {
      // Arquivo pode já não existir — não é um erro relevante aqui.
    }
  }

  private resolverCaminhoSeguro(nome: string): string {
    if (!NOME_ARQUIVO_REGEX.test(nome) || basename(nome) !== nome) {
      throw new BadRequestException('Nome de arquivo de backup inválido.');
    }
    return join(this.diretorio, nome);
  }

  private paraNomeDeArquivo(data: Date): string {
    return data.toISOString().slice(0, 19).replace(/:/g, '-');
  }

  private dataDoNome(nome: string): Date | null {
    const m = NOME_ARQUIVO_REGEX.exec(nome);
    if (!m) {
      return null;
    }
    const [, dataParte, hora, minuto, segundo] = m;
    return new Date(`${dataParte}T${hora}:${minuto}:${segundo}.000Z`);
  }
}
