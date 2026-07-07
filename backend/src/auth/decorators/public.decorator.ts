import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca um endpoint como público (sem exigência de autenticação).
 * Por padrão, TODA rota exige autenticação (ver JwtAuthGuard global) —
 * este decorator é a exceção explícita, evitando exposição acidental
 * de dados (fail-secure / secure by default).
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
