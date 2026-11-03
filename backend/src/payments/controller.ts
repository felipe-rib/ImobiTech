import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { authenticate, allow } from '../auth/guards.js';
import { idSchema } from '../shared/domain.js';
import { PaymentService } from './service.js';
import type { Config } from '../shared/config.js';
import { HttpError } from '../shared/domain.js';
import {
  LocalDocumentStorage,
  MAX_DOCUMENT_BYTES,
  validateDocument,
} from '../shared/document-storage.js';
import { transaction } from '../shared/transaction.js';
import { businessToday } from '../shared/rental-validation.js';
import { resolve } from 'node:path';
export function paymentsController(app: FastifyInstance, db: Pool, config: Config) {
  const read = [authenticate(db), allow('admin', 'owner', 'tenant')];
  const write = [authenticate(db), allow('admin')];
  const storage = new LocalDocumentStorage(
    resolve(
      config.PHOTO_STORAGE_DIR ?? resolve(process.cwd(), '.local/property-photos'),
      'financial-documents',
    ),
  );
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
  app.post<{ Params: { id: string } }>(
    '/payments/:id/proof',
    { preHandler: [authenticate(db), allow('tenant')], bodyLimit: MAX_DOCUMENT_BYTES },
    async (req, reply) => {
      const id = idSchema.parse(req.params.id);
      if (!Buffer.isBuffer(req.body)) throw new HttpError(400, 'Selecione um comprovante.');
      const type = validateDocument(req.body, req.headers['content-type']?.split(';')[0] ?? '');
      const key = await storage.save(req.body, type);
      try {
        const old = await transaction(
          db,
          async (c) => {
            const current = (
              await c.query(
                `SELECT p.proof_key,p.review_status,p.paid_at FROM payments p
            JOIN contracts ct ON ct.id=p.contract_id WHERE p.id=$1 AND ct.tenant_id=$2 FOR UPDATE OF p`,
                [id, req.user.id],
              )
            ).rows[0];
            if (!current) throw new HttpError(404, 'Parcela não encontrada.');
            if (current.paid_at || current.review_status === 'submitted')
              throw new HttpError(409, 'Esta parcela já foi enviada ou aprovada.');
            await c.query(
              `UPDATE payments SET proof_key=$2,proof_type=$3,submitted_at=now(),review_status='submitted'
            WHERE id=$1`,
              [id, key, type],
            );
            return current.proof_key as string | null;
          },
          req.user.id,
        );
        if (old) await storage.remove(old);
        return reply.code(201).send({ review_status: 'submitted' });
      } catch (error) {
        await storage.remove(key);
        throw error;
      }
    },
  );
  app.get<{ Params: { id: string } }>(
    '/payments/:id/proof',
    { preHandler: [authenticate(db), allow('admin', 'tenant')] },
    async (req, reply) => {
      const id = idSchema.parse(req.params.id);
      const payment = await new PaymentService(db).detail(id, req.user);
      const row = (
        await db.query('SELECT proof_key,proof_type FROM payments WHERE id=$1', [payment.id])
      ).rows[0];
      if (!row?.proof_key) throw new HttpError(404, 'Comprovante não encontrado.');
      return reply
        .header('Content-Disposition', 'attachment; filename="comprovante"')
        .type(row.proof_type)
        .send(await storage.read(row.proof_key));
    },
  );
  app.post<{ Params: { id: string } }>(
    '/payments/:id/review',
    { preHandler: write },
    async (req) => {
      const id = idSchema.parse(req.params.id);
      const { decision } = z
        .object({ decision: z.enum(['approved', 'rejected']) })
        .strict()
        .parse(req.body);
      return transaction(
        db,
        async (c) => {
          const payment = (
            await c.query('SELECT review_status FROM payments WHERE id=$1 FOR UPDATE', [id])
          ).rows[0];
          if (!payment) throw new HttpError(404, 'Parcela não encontrada.');
          if (payment.review_status !== 'submitted')
            throw new HttpError(409, 'Aguarde um comprovante enviado pelo inquilino.');
          const result = await c.query(
            `UPDATE payments SET review_status=$2,paid_at=$3 WHERE id=$1
        RETURNING id,review_status,paid_at`,
            [id, decision, decision === 'approved' ? businessToday() : null],
          );
          return result.rows[0];
        },
        req.user.id,
      );
    },
  );
}
