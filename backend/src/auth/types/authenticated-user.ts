import { Papel } from '@prisma/client';

/** Representação mínima do usuário autenticado anexada à requisição (req.user). */
export interface AuthenticatedUser {
  id: string;
  email: string;
  papel: Papel;
  /** ID do registro Tecnico vinculado — populado apenas para papel=TECNICO. */
  tecnicoId?: string | null;
  /**
   * true quando a senha atual é provisória (definida por um admin) e ainda
   * precisa ser trocada. Opcional para não obrigar todo fixture de teste em
   * outros módulos a informá-lo — em runtime, JwtAccessStrategy sempre o
   * popula a partir do banco; ausência é tratada como "sem pendência".
   */
  precisaTrocarSenha?: boolean;
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
