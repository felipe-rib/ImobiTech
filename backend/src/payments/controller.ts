import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { authenticate, allow } from '../auth/guards.js';
import { idSchema } from '../shared/domain.js';
import { PaymentService } from './service.js';
export function paymentsController(app: FastifyInstance, db: Pool) {
  const read = [authenticate(db), allow('admin', 'owner', 'tenant')];
  const write = [authenticate(db), allow('admin')];
  app.get<{ Params: { id: string } }>('/contracts/:id/payments', { preHandler: read }, (req) => {
    const q = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        status: z.enum(['paid', 'pending', 'overdue']).optional(),
      })
      .parse(req.query);
    return new PaymentService(db).list(idSchema.parse(req.params.id), req.user, q.page, q.status);
  });
  app.get<{ Params: { id: string } }>('/payments/:id', { preHandler: read }, (req) =>
    new PaymentService(db).detail(idSchema.parse(req.params.id), req.user),
  );
  app.post<{ Params: { id: string } }>(
    '/contracts/:id/payments',
    { preHandler: write },
    async (req, reply) =>
      reply
        .code(201)
        .send(await new PaymentService(db).save(req.body, req.user, idSchema.parse(req.params.id))),
  );
  app.patch<{ Params: { id: string } }>('/payments/:id', { preHandler: write }, (req) =>
    new PaymentService(db).save(req.body, req.user, undefined, idSchema.parse(req.params.id)),
  );
}
