import { cpfEhValido } from './is-cpf.validator';

describe('cpfEhValido', () => {
  it('aceita CPFs válidos com ou sem máscara', () => {
    expect(cpfEhValido('52998224725')).toBe(true);
    expect(cpfEhValido('529.982.247-25')).toBe(true);
  });

  it('rejeita CPFs com dígitos verificadores incorretos', () => {
    expect(cpfEhValido('52998224700')).toBe(false);
  });

  it('rejeita sequências repetidas (ex.: 111.111.111-11), classicamente aceitas pelo cálculo de dígito', () => {
    expect(cpfEhValido('11111111111')).toBe(false);
    expect(cpfEhValido('00000000000')).toBe(false);
  });

  it('rejeita valores com tamanho diferente de 11 dígitos', () => {
    expect(cpfEhValido('123456789')).toBe(false);
    expect(cpfEhValido('123456789012')).toBe(false);
  });

  it('rejeita valores não numéricos ou vazios', () => {
    expect(cpfEhValido('abc.def.ghi-jk')).toBe(false);
    expect(cpfEhValido('')).toBe(false);
  });
});
