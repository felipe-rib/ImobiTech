import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { authenticate, allow } from '../auth/guards.js';
import { idSchema } from '../shared/domain.js';
import { rentalList } from '../shared/rental-validation.js';
import { VisitRepository } from './repository.js';
import { VisitService } from './service.js';
export function visitsController(app: FastifyInstance, db: Pool) {
  app.get('/visits', { preHandler: [authenticate(db), allow('admin', 'broker')] }, (req) =>
    new VisitRepository(db).list(
      rentalList
        .extend({ status: z.enum(['scheduled', 'confirmed', 'cancelled']).optional() })
        .parse(req.query),
      req.user,
    ),
  );
  const write = [authenticate(db), allow('broker')];
  app.post('/visits', { preHandler: write }, async (req, reply) =>
    reply.code(201).send(await new VisitService(db).create(req.body, req.user)),
  );
  app.patch<{ Params: { id: string } }>('/visits/:id', { preHandler: write }, (req) =>
    new VisitService(db).update(idSchema.parse(req.params.id), req.body, req.user),
  );
}
