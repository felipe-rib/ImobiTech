import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { authenticate, allow } from '../auth/guards.js';
import { idSchema } from '../shared/domain.js';
import { rentalList } from '../shared/rental-validation.js';
import { ContractRepository } from './repository.js';
import { ContractService } from './service.js';
export function contractsController(app: FastifyInstance, db: Pool) {
  const read = [authenticate(db), allow('admin', 'owner', 'tenant')];
  const write = [authenticate(db), allow('admin')];
  app.get('/contracts/options', { preHandler: write }, (req) => {
    const q = z
      .object({ kind: z.enum(['properties', 'tenants']), search: z.string().max(100).default('') })
      .parse(req.query);
    return new ContractRepository(db).options(q.kind, q.search);
  });
  app.get('/contracts', { preHandler: read }, (req) =>
    new ContractRepository(db).list(
      rentalList.extend({ status: z.enum(['active', 'closed']).optional() }).parse(req.query),
      req.user,
    ),
  );
  app.get<{ Params: { id: string } }>('/contracts/:id', { preHandler: read }, (req) =>
    new ContractService(db).detail(idSchema.parse(req.params.id), req.user),
  );
  app.get<{ Params: { id: string } }>(
    '/contracts/:id/history',
    { preHandler: write },
    async (req) => {
      const id = idSchema.parse(req.params.id);
      await new ContractService(db).detail(id, req.user);
      return new ContractRepository(db).history(id);
    },
  );
  app.post('/contracts', { preHandler: write }, async (req, reply) =>
    reply.code(201).send(await new ContractService(db).create(req.body, req.user)),
  );
  app.patch<{ Params: { id: string } }>('/contracts/:id', { preHandler: write }, (req) =>
    new ContractService(db).update(idSchema.parse(req.params.id), req.body, req.user),
  );
}
