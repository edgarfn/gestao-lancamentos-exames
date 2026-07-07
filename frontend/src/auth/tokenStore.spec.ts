import { afterEach, describe, expect, it } from 'vitest';
import { tokenStore } from './tokenStore';
import type { UsuarioAutenticado } from '@/types/domain';

const usuario: UsuarioAutenticado = { id: 'user-1', nome: 'Ana', email: 'ana@b.com', papel: 'TECNICO' };

describe('tokenStore', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('persiste e recupera a sessão em sessionStorage (não em localStorage — reduz exposição)', () => {
    tokenStore.salvar({ accessToken: 'access-1', refreshToken: 'refresh-1', usuario });

    expect(tokenStore.carregar()).toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1', usuario });
    expect(localStorage.getItem('exames:sessao')).toBeNull();
    expect(sessionStorage.getItem('exames:sessao')).not.toBeNull();
  });

  it('retorna null quando não há sessão armazenada', () => {
    expect(tokenStore.carregar()).toBeNull();
  });

  it('descarta e remove dados corrompidos em vez de propagar o erro de parse', () => {
    sessionStorage.setItem('exames:sessao', '{json-invalido');

    expect(tokenStore.carregar()).toBeNull();
    expect(sessionStorage.getItem('exames:sessao')).toBeNull();
  });

  it('limpar remove a sessão armazenada', () => {
    tokenStore.salvar({ accessToken: 'access-1', refreshToken: 'refresh-1', usuario });

    tokenStore.limpar();

    expect(tokenStore.carregar()).toBeNull();
  });
});
