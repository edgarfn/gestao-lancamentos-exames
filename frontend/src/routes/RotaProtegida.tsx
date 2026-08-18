import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import { useAuth } from '@/auth/AuthContext';
import type { Papel } from '@/types/domain';

interface RotaProtegidaProps {
  papeis?: Papel[];
}

const ROTA_TROCA_SENHA_OBRIGATORIA = '/trocar-senha-obrigatoria';

/**
 * Protege rotas exigindo autenticação e, opcionalmente, papéis específicos
 * (RBAC no frontend). Importante: isto é uma camada de UX — a autorização
 * real e definitiva é sempre aplicada no backend (defesa em profundidade,
 * nunca confie apenas no controle de acesso do cliente).
 *
 * Enquanto a conta tiver uma senha provisória pendente de troca
 * (usuario.precisaTrocarSenha), toda rota protegida redireciona para a
 * tela obrigatória de troca de senha — o backend aplica o mesmo bloqueio
 * de forma independente (TrocaSenhaObrigatoriaGuard).
 */
export function RotaProtegida({ papeis }: RotaProtegidaProps) {
  const { usuario, carregando, possuiPapel } = useAuth();
  const location = useLocation();

  if (carregando) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace state={{ de: location }} />;
  }

  const naTelaDeTrocaObrigatoria = location.pathname === ROTA_TROCA_SENHA_OBRIGATORIA;

  if (usuario.precisaTrocarSenha && !naTelaDeTrocaObrigatoria) {
    return <Navigate to={ROTA_TROCA_SENHA_OBRIGATORIA} replace />;
  }

  if (!usuario.precisaTrocarSenha && naTelaDeTrocaObrigatoria) {
    return <Navigate to="/" replace />;
  }

  if (papeis && !possuiPapel(...papeis)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
