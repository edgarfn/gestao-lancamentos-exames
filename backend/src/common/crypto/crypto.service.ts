import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // recomendado para GCM
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32; // AES-256

/**
 * Serviço central de cifragem em nível de aplicação para dados pessoais
 * sensíveis (ex.: CPF e contato de pacientes/técnicos), implementando
 * "privacy by design": mesmo com acesso direto ao banco, esses campos
 * permanecem ilegíveis sem a chave (mantida fora do banco, em variável de
 * ambiente / gerenciador de segredos).
 *
 * Formato armazenado: base64(iv) + ":" + base64(authTag) + ":" + base64(cipherText)
 *
 * Também fornece um hash determinístico (HMAC-like via SHA-256 com a chave
 * como "pepper") para permitir busca exata por documento sem expor o valor
 * em texto claro nem permitir correlação por terceiros com acesso ao banco.
 */
@Injectable()
export class CryptoService implements OnModuleInit {
  private key!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const rawKey = this.config.get<string>('DATA_ENCRYPTION_KEY');
    if (!rawKey) {
      throw new Error('DATA_ENCRYPTION_KEY não configurada — abortando inicialização.');
    }
    // Deriva uma chave de 32 bytes a partir do segredo configurado, garantindo
    // o tamanho exigido pelo AES-256 independentemente da codificação de entrada.
    this.key = createHash('sha256').update(rawKey).digest().subarray(0, KEY_LENGTH_BYTES);
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
  }

  decrypt(payload: string): string {
    const [ivB64, authTagB64, dataB64] = payload.split(':');
    if (!ivB64 || !authTagB64 || !dataB64) {
      throw new Error('Formato de dado cifrado inválido.');
    }
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = createDecipheriv(ALGORITHM, this.key, iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Hash de busca: permite localizar registros por valor exato (ex.: CPF)
   * sem decifrar todos os registros nem armazenar o valor em texto claro.
   * Usa a chave de cifragem como "pepper" para impedir ataques de dicionário
   * por quem tiver acesso apenas ao banco de dados.
   */
  searchHash(value: string): string {
    const normalized = value.trim().toLowerCase();
    return createHash('sha256').update(this.key).update(normalized).digest('hex');
  }
}
