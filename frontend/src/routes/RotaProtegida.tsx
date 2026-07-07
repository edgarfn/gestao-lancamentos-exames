import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import { useAuth } from '@/auth/AuthContext';
import type { Papel } from '@/types/domain';

interface RotaProtegidaProps {
  papeis?: Papel[];
}

/**
 * Protege rotas exigindo autenticação e, opcionalmente, papéis específicos
 * (RBAC no frontend). Importante: isto é uma camada de UX — a autorização
 * real e definitiva é sempre aplicada no backend (defesa em profundidade,
 * nunca confie apenas no controle de acesso do cliente).
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

  if (papeis && !possuiPapel(...papeis)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
