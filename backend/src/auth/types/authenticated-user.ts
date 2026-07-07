import { Papel } from '@prisma/client';

/** Representação mínima do usuário autenticado anexada à requisição (req.user). */
export interface AuthenticatedUser {
  id: string;
  email: string;
  papel: Papel;
  /** ID do registro Tecnico vinculado — populado apenas para papel=TECNICO. */
  tecnicoId?: string | null;
}

export interface JwtAccessPayload {
  sub: string;
  email: string;
  papel: Papel;
  type: 'access';
}

export interface JwtRefreshPayload {
  sub: string;
  type: 'refresh';
  /** Versão da sessão — permite revogar todos os refresh tokens de um usuário. */
  sessionVersion: number;
}
