import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

function criarServico(chave = 'chave-de-teste-bem-secreta'): CryptoService {
  const config = { get: jest.fn().mockReturnValue(chave) } as unknown as ConfigService;
  const servico = new CryptoService(config);
  servico.onModuleInit();
  return servico;
}

describe('CryptoService', () => {
  it('cifra e decifra preservando o valor original', () => {
    const servico = criarServico();
    const textoOriginal = 'Documento sigiloso: 123.456.789-00';

    const cifrado = servico.encrypt(textoOriginal);

    expect(cifrado).not.toEqual(textoOriginal);
    expect(servico.decrypt(cifrado)).toBe(textoOriginal);
  });

  it('gera saídas diferentes para a mesma entrada (IV aleatório, sem padrão recuperável)', () => {
    const servico = criarServico();
    const textoOriginal = 'mesmo-valor';

    const primeiraCifragem = servico.encrypt(textoOriginal);
    const segundaCifragem = servico.encrypt(textoOriginal);

    expect(primeiraCifragem).not.toEqual(segundaCifragem);
    expect(servico.decrypt(primeiraCifragem)).toBe(textoOriginal);
    expect(servico.decrypt(segundaCifragem)).toBe(textoOriginal);
  });

  it('rejeita payload cifrado adulterado (proteção de integridade do GCM)', () => {
    const servico = criarServico();
    const cifrado = servico.encrypt('valor-protegido');
    const [iv, authTag, dados] = cifrado.split(':');
    const dadosAdulterados = Buffer.from(dados, 'base64');
    dadosAdulterados[0] ^= 0xff;
    const cifradoAdulterado = [iv, authTag, dadosAdulterados.toString('base64')].join(':');

    expect(() => servico.decrypt(cifradoAdulterado)).toThrow();
  });

  it('rejeita payload com formato inválido', () => {
    const servico = criarServico();

    expect(() => servico.decrypt('payload-sem-separadores')).toThrow('Formato de dado cifrado inválido.');
  });

  it('lança erro de inicialização quando a chave não está configurada', () => {
    const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    const servico = new CryptoService(config);

    expect(() => servico.onModuleInit()).toThrow(
      'DATA_ENCRYPTION_KEY não configurada — abortando inicialização.',
    );
  });

  describe('searchHash', () => {
    it('produz o mesmo hash para o mesmo valor (permitindo busca exata)', () => {
      const servico = criarServico();

      expect(servico.searchHash('12345678900')).toBe(servico.searchHash('12345678900'));
    });

    it('normaliza espaços e caixa antes de gerar o hash', () => {
      const servico = criarServico();

      expect(servico.searchHash('  Joao@Email.com  ')).toBe(servico.searchHash('joao@email.com'));
    });

    it('produz hashes diferentes para chaves de cifragem diferentes (efeito pepper)', () => {
      const servicoA = criarServico('chave-um');
      const servicoB = criarServico('chave-dois');

      expect(servicoA.searchHash('mesmo-documento')).not.toBe(servicoB.searchHash('mesmo-documento'));
    });

    it('não é reversível para o valor original', () => {
      const servico = criarServico();

      const hash = servico.searchHash('12345678900');

      expect(hash).not.toContain('12345678900');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
