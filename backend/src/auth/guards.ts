import type { FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { HttpError, type Role, type User } from '../shared/domain.js';
import { SessionRepository } from './repository.js';
declare module 'fastify' {
  interface FastifyRequest {
    user: User;
  }
}
export function authenticate(db: Pool) {
  return async (request: FastifyRequest) => {
    const token = request.cookies.imobitech_session;
    const user =
      token && /^[a-f0-9]{64}$/.test(token)
        ? await new SessionRepository(db).user(token)
        : undefined;
    if (!user) throw new HttpError(401, 'Entre na sua conta para continuar.');
    request.user = user;
  };
}
export function allow(...roles: Role[]) {
  return async (request: FastifyRequest) => {
    if (!roles.includes(request.user.role))
      throw new HttpError(403, 'Você não tem permissão para esta operação.');
  };
}
