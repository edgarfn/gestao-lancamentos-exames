import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { tokenStore } from './tokenStore';
import { httpClient, registrarCallbackSessaoInvalida } from '@/api/httpClient';
import type { UsuarioAutenticado } from '@/types/domain';

vi.mock('@/api/httpClient', () => ({
  httpClient: { post: vi.fn() },
  registrarCallbackSessaoInvalida: vi.fn(),
}));

const usuario: UsuarioAutenticado = { id: 'user-1', nome: 'Ana', email: 'ana@b.com', papel: 'GESTOR' };

function PainelDeTeste() {
  const { usuario: atual, carregando, entrar, sair, possuiPapel } = useAuth();
  return (
    <div>
      <span data-testid="carregando">{String(carregando)}</span>
      <span data-testid="usuario">{atual ? atual.email : 'anonimo'}</span>
      <span data-testid="pode-admin">{String(possuiPapel('ADMIN'))}</span>
      <span data-testid="pode-gestor">{String(possuiPapel('GESTOR', 'ADMIN'))}</span>
      <button onClick={() => entrar('ana@b.com', 'Senha123!', 'token-turnstile-teste')}>entrar</button>
      <button onClick={sair}>sair</button>
    </div>
  );
}

describe('AuthProvider / useAuth', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('inicializa a partir da sessão persistida em sessionStorage e registra o callback de sessão inválida', async () => {
    tokenStore.salvar({ accessToken: 'access-1', refreshToken: 'refresh-1', usuario });

    render(
      <AuthProvider>
        <PainelDeTeste />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('carregando')).toHaveTextContent('false'));
    expect(screen.getByTestId('usuario')).toHaveTextContent('ana@b.com');
    expect(screen.getByTestId('pode-gestor')).toHaveTextContent('true');
    expect(screen.getByTestId('pode-admin')).toHaveTextContent('false');
    expect(registrarCallbackSessaoInvalida).toHaveBeenCalled();
  });

  it('inicia sem usuário quando não há sessão persistida', async () => {
    render(
      <AuthProvider>
        <PainelDeTeste />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('carregando')).toHaveTextContent('false'));
    expect(screen.getByTestId('usuario')).toHaveTextContent('anonimo');
  });

  it('entrar autentica, persiste a sessão e atualiza o usuário no contexto', async () => {
    vi.mocked(httpClient.post).mockResolvedValue({
      data: { accessToken: 'novo-access', refreshToken: 'novo-refresh', usuario },
    });
    const usuarioInteragindo = userEvent.setup();

    render(
      <AuthProvider>
        <PainelDeTeste />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('carregando')).toHaveTextContent('false'));

    await act(async () => {
      await usuarioInteragindo.click(screen.getByText('entrar'));
    });

    expect(httpClient.post).toHaveBeenCalledWith('/auth/login', {
      email: 'ana@b.com',
      senha: 'Senha123!',
      turnstileToken: 'token-turnstile-teste',
    });
    expect(screen.getByTestId('usuario')).toHaveTextContent('ana@b.com');
    expect(tokenStore.carregar()).toEqual({
      accessToken: 'novo-access',
      refreshToken: 'novo-refresh',
      usuario,
    });
  });

  it('sair limpa a sessão persistida e redefine o usuário do contexto para nulo', async () => {
    tokenStore.salvar({ accessToken: 'access-1', refreshToken: 'refresh-1', usuario });
    const usuarioInteragindo = userEvent.setup();

    render(
      <AuthProvider>
        <PainelDeTeste />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('usuario')).toHaveTextContent('ana@b.com'));

    await act(async () => {
      await usuarioInteragindo.click(screen.getByText('sair'));
    });

    expect(screen.getByTestId('usuario')).toHaveTextContent('anonimo');
    expect(tokenStore.carregar()).toBeNull();
  });

  it('useAuth lança erro quando usado fora de um AuthProvider (uso indevido detectável em desenvolvimento)', () => {
    const consoleErroOriginal = console.error;
    console.error = vi.fn();

    expect(() => render(<PainelDeTeste />)).toThrow('useAuth deve ser usado dentro de um AuthProvider.');

    console.error = consoleErroOriginal;
  });
});
