import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { authenticate, allow } from '../auth/guards.js';
import { HttpError, idSchema, listSchema } from '../shared/domain.js';
import { PropertyRepository } from './repository.js';
import { PropertyService } from './service.js';
export function propertiesController(app: FastifyInstance, db: Pool) {
  const read = [authenticate(db), allow('admin', 'broker', 'owner')];
  const write = [authenticate(db), allow('admin', 'broker')];
  app.get('/properties/owners', { preHandler: write }, (req) =>
    new PropertyRepository(db).owners(listSchema.parse(req.query).search),
  );
  app.get('/properties', { preHandler: read }, (req) =>
    new PropertyRepository(db).list(
      listSchema.parse(req.query),
      req.user.role === 'owner' ? req.user.id : undefined,
    ),
  );
  app.get<{ Params: { id: string } }>('/properties/:id', { preHandler: read }, async (req) => {
    const p = await new PropertyRepository(db).byId(
      idSchema.parse(req.params.id),
      req.user.role === 'owner' ? req.user.id : undefined,
    );
    if (!p) throw new HttpError(404, 'Imóvel não encontrado.');
    return p;
  });
  app.post('/properties', { preHandler: write }, async (req, reply) =>
    reply.code(201).send(await new PropertyService(db).save(req.body)),
  );
  app.patch<{ Params: { id: string } }>('/properties/:id', { preHandler: write }, (req) =>
    new PropertyService(db).save(req.body, idSchema.parse(req.params.id)),
  );
}
