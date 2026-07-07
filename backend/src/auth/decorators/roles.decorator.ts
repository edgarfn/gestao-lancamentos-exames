import { SetMetadata } from '@nestjs/common';
import { Papel } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Restringe o acesso ao endpoint aos papéis informados (RBAC). */
export const Roles = (...roles: Papel[]): MethodDecorator & ClassDecorator => SetMetadata(ROLES_KEY, roles);
