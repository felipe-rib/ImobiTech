import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { authenticate, allow } from '../auth/guards.js';
import { HttpError, idSchema, listSchema } from '../shared/domain.js';
import { UserRepository } from './repository.js';
import { UserService } from './service.js';
export function usersController(app: FastifyInstance, db: Pool) {
  const preHandler = [authenticate(db), allow('admin')];
  app.get('/users', { preHandler }, (req) =>
    new UserRepository(db).list(listSchema.parse(req.query)),
  );
  app.post('/users', { preHandler }, async (req, reply) =>
    reply.code(201).send(await new UserService(db).create(req.body)),
  );
  app.get<{ Params: { id: string } }>('/users/:id', { preHandler }, async (req) => {
    const user = await new UserRepository(db).byId(idSchema.parse(req.params.id));
    if (!user) throw new HttpError(404, 'Usuário não encontrado.');
    return user;
  });
  app.patch<{ Params: { id: string } }>('/users/:id', { preHandler }, (req) =>
    new UserService(db).update(idSchema.parse(req.params.id), req.body),
  );
}
