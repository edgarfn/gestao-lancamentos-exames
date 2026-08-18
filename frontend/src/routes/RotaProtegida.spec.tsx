import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RotaProtegida } from './RotaProtegida';
import { useAuth } from '@/auth/AuthContext';
import type { UsuarioAutenticado } from '@/types/domain';

vi.mock('@/auth/AuthContext', () => ({ useAuth: vi.fn() }));

const usuarioMockado = vi.mocked(useAuth);

function montar() {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={['/area-restrita']}>
        <Routes>
          <Route path="/login" element={<span>Tela de login</span>} />
          <Route path="/" element={<span>Painel</span>} />
          <Route element={<RotaProtegida papeis={['ADMIN']} />}>
            <Route path="/area-restrita" element={<span>Conteúdo restrito</span>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

function contexto(parcial: Partial<ReturnType<typeof useAuth>>): ReturnType<typeof useAuth> {
  return {
    usuario: null,
    carregando: false,
    entrar: vi.fn(),
    sair: vi.fn(),
    possuiPapel: vi.fn().mockReturnValue(false),
    atualizarDadosDaSessao: vi.fn(),
    ...parcial,
  };
}

describe('RotaProtegida', () => {
  it('exibe um indicador de carregamento enquanto a sessão ainda está sendo restaurada', () => {
    usuarioMockado.mockReturnValue(contexto({ carregando: true }));

    montar();

    expect(screen.queryByText('Conteúdo restrito')).not.toBeInTheDocument();
    expect(screen.queryByText('Tela de login')).not.toBeInTheDocument();
  });

  it('redireciona para /login quando não há usuário autenticado', () => {
    usuarioMockado.mockReturnValue(contexto({ usuario: null }));

    montar();

    expect(screen.getByText('Tela de login')).toBeInTheDocument();
  });

  it('redireciona para a página inicial quando o usuário não possui o papel exigido (RBAC)', () => {
    const usuario: UsuarioAutenticado = {
      id: 'user-1',
      nome: 'Ana',
      email: 'ana@b.com',
      papel: 'TECNICO',
      precisaTrocarSenha: false,
    };
    usuarioMockado.mockReturnValue(contexto({ usuario, possuiPapel: vi.fn().mockReturnValue(false) }));

    montar();

    expect(screen.getByText('Painel')).toBeInTheDocument();
  });

  it('renderiza o conteúdo da rota quando o usuário está autenticado e possui o papel exigido', () => {
    const usuario: UsuarioAutenticado = {
      id: 'user-1',
      nome: 'Ana',
      email: 'ana@b.com',
      papel: 'ADMIN',
      precisaTrocarSenha: false,
    };
    usuarioMockado.mockReturnValue(contexto({ usuario, possuiPapel: vi.fn().mockReturnValue(true) }));

    montar();

    expect(screen.getByText('Conteúdo restrito')).toBeInTheDocument();
  });

  it('redireciona para /trocar-senha-obrigatoria quando a senha atual é provisória', () => {
    const usuario: UsuarioAutenticado = {
      id: 'user-1',
      nome: 'Ana',
      email: 'ana@b.com',
      papel: 'ADMIN',
      precisaTrocarSenha: true,
    };
    usuarioMockado.mockReturnValue(contexto({ usuario, possuiPapel: vi.fn().mockReturnValue(true) }));

    render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/area-restrita']}>
          <Routes>
            <Route path="/login" element={<span>Tela de login</span>} />
            <Route path="/" element={<span>Painel</span>} />
            <Route path="/trocar-senha-obrigatoria" element={<span>Troca de senha obrigatória</span>} />
            <Route element={<RotaProtegida papeis={['ADMIN']} />}>
              <Route path="/area-restrita" element={<span>Conteúdo restrito</span>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </MantineProvider>,
    );

    expect(screen.getByText('Troca de senha obrigatória')).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo restrito')).not.toBeInTheDocument();
  });

  it('redireciona para a página inicial ao acessar /trocar-senha-obrigatoria sem pendência', () => {
    const usuario: UsuarioAutenticado = {
      id: 'user-1',
      nome: 'Ana',
      email: 'ana@b.com',
      papel: 'ADMIN',
      precisaTrocarSenha: false,
    };
    usuarioMockado.mockReturnValue(contexto({ usuario, possuiPapel: vi.fn().mockReturnValue(true) }));

    render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/trocar-senha-obrigatoria']}>
          <Routes>
            <Route path="/login" element={<span>Tela de login</span>} />
            <Route path="/" element={<span>Painel</span>} />
            <Route element={<RotaProtegida />}>
              <Route path="/trocar-senha-obrigatoria" element={<span>Troca de senha obrigatória</span>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </MantineProvider>,
    );

    expect(screen.getByText('Painel')).toBeInTheDocument();
    expect(screen.queryByText('Troca de senha obrigatória')).not.toBeInTheDocument();
  });
});
