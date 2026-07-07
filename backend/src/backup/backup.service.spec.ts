import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { execFile } from 'child_process';
import { createReadStream } from 'fs';
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { BackupService } from './backup.service';
import { AuditService } from '../common/audit/audit.service';

jest.mock('child_process', () => ({ ...jest.requireActual('child_process'), execFile: jest.fn() }));
jest.mock('fs', () => ({ ...jest.requireActual('fs'), createReadStream: jest.fn() }));
jest.mock('fs/promises', () => ({
  ...jest.requireActual('fs/promises'),
  mkdir: jest.fn(),
  readFile: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  unlink: jest.fn(),
  writeFile: jest.fn(),
}));

const execFileMock = execFile as unknown as jest.Mock;
const mkdirMock = mkdir as jest.Mock;
const readFileMock = readFile as jest.Mock;
const readdirMock = readdir as jest.Mock;
const statMock = stat as jest.Mock;
const unlinkMock = unlink as jest.Mock;
const writeFileMock = writeFile as jest.Mock;
const createReadStreamMock = createReadStream as jest.Mock;

const DIRETORIO = '/var/backups/exames';
const NOME_VALIDO = 'backup-2026-06-08T02-00-00.dump';
const NOME_ENC = 'backup-2026-06-08T02-00-00.dump.enc';
const SEM_CONTEXTO = { usuarioId: null, enderecoIp: null, enderecoIpProxy: null, userAgent: null };
const contextoUsuario = { usuarioId: 'user-1', enderecoIp: '203.0.113.10', enderecoIpProxy: null, userAgent: 'jest-agent' };

function caminho(nome: string): string {
  return join(DIRETORIO, nome);
}

function sucessoExecFile() {
  execFileMock.mockImplementation(
    (_cmd: string, _args: string[], callback: (err: Error | null, result?: unknown) => void) =>
      callback(null, { stdout: '', stderr: '' }),
  );
}

function falhaExecFile(mensagem: string) {
  execFileMock.mockImplementation((_cmd: string, _args: string[], callback: (err: Error | null) => void) =>
    callback(new Error(mensagem)),
  );
}

describe('BackupService', () => {
  let audit: { registrar: jest.Mock };
  let config: { get: jest.Mock; getOrThrow: jest.Mock };
  let service: BackupService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-08T02:00:00.000Z'));
    jest.clearAllMocks();

    audit = { registrar: jest.fn().mockResolvedValue(undefined) };
    config = {
      get: jest.fn((chave: string, valorPadrao?: unknown) => {
        if (chave === 'BACKUP_DIR') return DIRETORIO;
        if (chave === 'BACKUP_RETENTION_DIAS') return 30;
        return valorPadrao;
      }),
      getOrThrow: jest.fn((chave: string) => {
        if (chave === 'DATABASE_URL') return 'postgresql://user:pass@postgres:5432/exames_db?schema=public';
        if (chave === 'DATA_ENCRYPTION_KEY') return 'test-key-32-chars-exactly-12345';
        return undefined;
      }),
    };
    mkdirMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue(Buffer.alloc(0));
    statMock.mockResolvedValue({ size: 1024, mtime: new Date('2026-06-08T02:00:00.000Z') });
    unlinkMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);

    service = new BackupService(config as unknown as ConfigService, audit as unknown as AuditService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('criar', () => {
    it('gera o backup com pg_dump no formato custom e registra a auditoria', async () => {
      sucessoExecFile();

      const resultado = await service.criar(contextoUsuario);

      expect(mkdirMock).toHaveBeenCalledWith(DIRETORIO, { recursive: true });
      expect(execFileMock).toHaveBeenCalledWith(
        'pg_dump',
        [
          '--format=custom',
          '--no-owner',
          `--file=${caminho('backup-2026-06-08T02-00-00.dump')}`,
          'postgresql://user:pass@postgres:5432/exames_db',
        ],
        expect.any(Function),
      );
      expect(resultado.nome).toBe('backup-2026-06-08T02-00-00.dump');
      expect(resultado.tamanhoBytes).toBe(1024);
      expect(resultado.criptografado).toBe(false);
      expect(audit.registrar).toHaveBeenCalledWith({
        ...contextoUsuario,
        acao: 'BACKUP_CRIACAO',
        entidade: 'Backup',
        entidadeId: 'backup-2026-06-08T02-00-00.dump',
        dadosNovos: { nome: 'backup-2026-06-08T02-00-00.dump', tamanhoBytes: 1024, criptografado: false },
      });
    });

    it('remove parâmetros Prisma (?schema=public) da DATABASE_URL antes de passar ao pg_dump', async () => {
      sucessoExecFile();

      await service.criar(contextoUsuario);

      const url = (execFileMock.mock.calls[0][1] as string[])[3];
      expect(url).toBe('postgresql://user:pass@postgres:5432/exames_db');
      expect(url).not.toContain('?');
    });

    it('remove o arquivo parcial e lança erro quando o pg_dump falha', async () => {
      falhaExecFile('pg_dump: error: connection failed');

      await expect(service.criar(contextoUsuario)).rejects.toBeInstanceOf(InternalServerErrorException);

      expect(unlinkMock).toHaveBeenCalledWith(caminho('backup-2026-06-08T02-00-00.dump'));
      expect(audit.registrar).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('filtra apenas arquivos com o padrão de nome esperado e ordena do mais recente para o mais antigo', async () => {
      readdirMock.mockResolvedValue([
        'backup-2026-06-01T02-00-00.dump',
        'backup-2026-06-08T02-00-00.dump',
        'arquivo-estranho.txt',
        '../backup-2026-06-08T02-00-00.dump.bak',
      ]);
      statMock.mockResolvedValue({ size: 2048, mtime: new Date() });

      const resultado = await service.listar();

      expect(resultado.map((item) => item.nome)).toEqual([
        'backup-2026-06-08T02-00-00.dump',
        'backup-2026-06-01T02-00-00.dump',
      ]);
      expect(resultado[0].criadoEm.toISOString()).toBe('2026-06-08T02:00:00.000Z');
    });

    it('reconhece arquivos .dump.enc como criptografados na listagem', async () => {
      readdirMock.mockResolvedValue([
        'backup-2026-06-08T02-00-00.dump',
        'backup-2026-06-07T02-00-00.dump.enc',
      ]);
      statMock.mockResolvedValue({ size: 1024, mtime: new Date() });

      const resultado = await service.listar();

      expect(resultado.find((i) => i.nome === 'backup-2026-06-08T02-00-00.dump')?.criptografado).toBe(false);
      expect(resultado.find((i) => i.nome === 'backup-2026-06-07T02-00-00.dump.enc')?.criptografado).toBe(true);
    });
  });

  describe('baixar', () => {
    it('rejeita nomes de arquivo que não seguem o padrão esperado (proteção contra path traversal)', async () => {
      await expect(service.baixar('../../etc/passwd')).rejects.toBeInstanceOf(BadRequestException);
      expect(statMock).not.toHaveBeenCalled();
    });

    it('lança NotFound quando o arquivo não existe', async () => {
      statMock.mockRejectedValue(new Error('ENOENT'));

      await expect(service.baixar(NOME_VALIDO)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('retorna um StreamableFile para um arquivo válido existente', async () => {
      statMock.mockResolvedValue({ size: 1024, mtime: new Date() });
      createReadStreamMock.mockReturnValue('stream-fake');

      const resultado = await service.baixar(NOME_VALIDO);

      expect(createReadStreamMock).toHaveBeenCalledWith(caminho(NOME_VALIDO));
      expect(resultado).toBeInstanceOf(StreamableFile);
    });
  });

  describe('remover', () => {
    it('rejeita nomes de arquivo inválidos', async () => {
      await expect(service.remover('../segredo.dump', contextoUsuario)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(unlinkMock).not.toHaveBeenCalled();
    });

    it('lança NotFound quando o arquivo não existe e não registra auditoria', async () => {
      unlinkMock.mockRejectedValue(new Error('ENOENT'));

      await expect(service.remover(NOME_VALIDO, contextoUsuario)).rejects.toBeInstanceOf(NotFoundException);
      expect(audit.registrar).not.toHaveBeenCalled();
    });

    it('remove o arquivo e registra a auditoria de exclusão', async () => {
      await service.remover(NOME_VALIDO, contextoUsuario);

      expect(unlinkMock).toHaveBeenCalledWith(caminho(NOME_VALIDO));
      expect(audit.registrar).toHaveBeenCalledWith({
        ...contextoUsuario,
        acao: 'BACKUP_EXCLUSAO',
        entidade: 'Backup',
        entidadeId: NOME_VALIDO,
        dadosNovos: { nome: NOME_VALIDO },
      });
    });
  });

  describe('restaurar', () => {
    it('executa o pg_restore com as flags de segurança esperadas e registra a auditoria', async () => {
      sucessoExecFile();

      await service.restaurar('/tmp/restauracao-123.dump', 'meu-backup.dump', contextoUsuario);

      expect(execFileMock).toHaveBeenCalledWith(
        'pg_restore',
        [
          '--clean',
          '--if-exists',
          '--no-owner',
          '--dbname=postgresql://user:pass@postgres:5432/exames_db',
          '/tmp/restauracao-123.dump',
        ],
        expect.any(Function),
      );
      expect(unlinkMock).toHaveBeenCalledWith('/tmp/restauracao-123.dump');
      expect(audit.registrar).toHaveBeenCalledWith({
        ...contextoUsuario,
        acao: 'BACKUP_RESTAURACAO',
        entidade: 'Backup',
        entidadeId: 'meu-backup.dump',
        dadosNovos: { nomeArquivoEnviado: 'meu-backup.dump' },
      });
    });

    it('remove o arquivo temporário mesmo quando o pg_restore falha, e não registra auditoria', async () => {
      falhaExecFile('pg_restore: error: invalid archive');

      await expect(
        service.restaurar('/tmp/restauracao-123.dump', 'meu-backup.dump', contextoUsuario),
      ).rejects.toBeInstanceOf(InternalServerErrorException);

      expect(unlinkMock).toHaveBeenCalledWith('/tmp/restauracao-123.dump');
      expect(audit.registrar).not.toHaveBeenCalled();
    });
  });

  describe('criptografia', () => {
    it('criar com criptografar=true gera .dump.enc, remove .dump original e inclui criptografado=true na auditoria', async () => {
      const criptografar = jest.spyOn(service as any, 'criptografarArquivo').mockResolvedValue(undefined);
      sucessoExecFile();

      const resultado = await service.criar(contextoUsuario, true);

      expect(criptografar).toHaveBeenCalledWith(caminho(NOME_VALIDO), caminho(NOME_ENC));
      expect(unlinkMock).toHaveBeenCalledWith(caminho(NOME_VALIDO));
      expect(resultado.nome).toBe(NOME_ENC);
      expect(resultado.criptografado).toBe(true);
      expect(audit.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'BACKUP_CRIACAO',
          entidadeId: NOME_ENC,
          dadosNovos: expect.objectContaining({ criptografado: true }),
        }),
      );
    });

    it('restaurar com .dump.enc descriptografa antes de chamar pg_restore e limpa ambos os arquivos temp', async () => {
      const descriptografar = jest.spyOn(service as any, 'descriptografarArquivo').mockResolvedValue(undefined);
      sucessoExecFile();

      await service.restaurar('/tmp/restauracao-123.dump', 'meu-backup.dump.enc', contextoUsuario);

      expect(descriptografar).toHaveBeenCalledWith(
        '/tmp/restauracao-123.dump',
        '/tmp/restauracao-123.dump.decrypted.dump',
      );
      expect(execFileMock).toHaveBeenCalledWith(
        'pg_restore',
        expect.arrayContaining(['/tmp/restauracao-123.dump.decrypted.dump']),
        expect.any(Function),
      );
      expect(unlinkMock).toHaveBeenCalledWith('/tmp/restauracao-123.dump');
      expect(unlinkMock).toHaveBeenCalledWith('/tmp/restauracao-123.dump.decrypted.dump');
    });

    it('descriptografarArquivo lança BadRequestException para dados sem magic bytes BKUP', async () => {
      readFileMock.mockResolvedValue(Buffer.from('conteudo-invalido'));

      await expect(
        (service as any).descriptografarArquivo('/tmp/bad.enc', '/tmp/out.dump'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('executarBackupProgramado', () => {
    it('gera um backup automático e remove backups expirados conforme a política de retenção', async () => {
      sucessoExecFile();
      statMock.mockResolvedValue({ size: 1024, mtime: new Date() });
      readdirMock.mockResolvedValue(['backup-2026-06-08T02-00-00.dump', 'backup-2026-04-01T02-00-00.dump']);

      await service.executarBackupProgramado();

      expect(execFileMock).toHaveBeenCalledWith('pg_dump', expect.any(Array), expect.any(Function));
      expect(audit.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ ...SEM_CONTEXTO, acao: 'BACKUP_CRIACAO' }),
      );
      expect(unlinkMock).toHaveBeenCalledWith(caminho('backup-2026-04-01T02-00-00.dump'));
      expect(unlinkMock).not.toHaveBeenCalledWith(caminho('backup-2026-06-08T02-00-00.dump'));
    });

    it('não interrompe a execução quando a geração do backup automático falha', async () => {
      falhaExecFile('pg_dump: error: connection failed');

      await expect(service.executarBackupProgramado()).resolves.toBeUndefined();
      expect(readdirMock).not.toHaveBeenCalled();
    });
  });
});
