import { forwardRef, useEffect } from 'react';
import { MantineProvider } from '@mantine/core';
import { Notifications, notifications } from '@mantine/notifications';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { LoginPage } from './LoginPage';
import { useAuth } from '@/auth/AuthContext';

vi.mock('@/auth/AuthContext', () => ({ useAuth: vi.fn() }));

const TOKEN_TURNSTILE_FALSO = 'token-turnstile-falso';

// O widget real depende do script da Cloudflare (indisponível em jsdom) — o
// dublê resolve o desafio instantaneamente, simulando o caminho feliz.
vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: forwardRef(function TurnstileDeTeste(
    { onSuccess }: { onSuccess?: (token: string) => void },
    _ref: unknown,
  ) {
    useEffect(() => {
      onSuccess?.(TOKEN_TURNSTILE_FALSO);
    }, [onSuccess]);
    return <div data-testid="turnstile-falso" />;
  }),
}));

const usuarioMockado = vi.mocked(useAuth);

function montar() {
  return render(
    <MantineProvider>
      <Notifications />
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('LoginPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('valida e-mail e tamanho mínimo da senha antes de chamar o serviço de autenticação', async () => {
    const entrar = vi.fn();
    usuarioMockado.mockReturnValue({
      usuario: null,
      carregando: false,
      entrar,
      sair: vi.fn(),
      possuiPapel: vi.fn(),
      atualizarDadosDaSessao: vi.fn(),
    });
    const usuarioInteragindo = userEvent.setup();

    montar();
    await usuarioInteragindo.type(screen.getByPlaceholderText('seu.email@exemplo.com'), 'email-invalido');
    await usuarioInteragindo.type(screen.getByPlaceholderText('Sua senha'), '123');
    await usuarioInteragindo.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(screen.getByText('A senha deve ter ao menos 8 caracteres.')).toBeInTheDocument();
    expect(entrar).not.toHaveBeenCalled();
  });

  it('envia as credenciais informadas quando o formulário é válido', async () => {
    const entrar = vi.fn().mockResolvedValue(undefined);
    usuarioMockado.mockReturnValue({
      usuario: null,
      carregando: false,
      entrar,
      sair: vi.fn(),
      possuiPapel: vi.fn(),
      atualizarDadosDaSessao: vi.fn(),
    });
    const usuarioInteragindo = userEvent.setup();

    montar();
    await usuarioInteragindo.type(screen.getByPlaceholderText('seu.email@exemplo.com'), 'ana@clinica.com');
    await usuarioInteragindo.type(screen.getByPlaceholderText('Sua senha'), 'SenhaForte123!');
    await usuarioInteragindo.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() =>
      expect(entrar).toHaveBeenCalledWith('ana@clinica.com', 'SenhaForte123!', TOKEN_TURNSTILE_FALSO),
    );
  });

  it('exibe a mensagem de erro retornada pela API quando a autenticação falha', async () => {
    const exibirNotificacao = vi.spyOn(notifications, 'show');
    const erroDeApi = new AxiosError('Request failed', '401', undefined, undefined, {
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config: {} as never,
      data: { message: 'Credenciais inválidas.' },
    });
    const entrar = vi.fn().mockRejectedValue(erroDeApi);
    usuarioMockado.mockReturnValue({
      usuario: null,
      carregando: false,
      entrar,
      sair: vi.fn(),
      possuiPapel: vi.fn(),
      atualizarDadosDaSessao: vi.fn(),
    });
    const usuarioInteragindo = userEvent.setup();

    montar();
    await usuarioInteragindo.type(screen.getByPlaceholderText('seu.email@exemplo.com'), 'ana@clinica.com');
    await usuarioInteragindo.type(screen.getByPlaceholderText('Sua senha'), 'SenhaForte123!');
    await usuarioInteragindo.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() =>
      expect(exibirNotificacao).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'red', message: 'Credenciais inválidas.' }),
      ),
    );
  });
});
