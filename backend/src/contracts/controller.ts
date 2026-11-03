import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { authenticate, allow } from '../auth/guards.js';
import { idSchema } from '../shared/domain.js';
import { rentalList } from '../shared/rental-validation.js';
import { ContractRepository } from './repository.js';
import { ContractService } from './service.js';
import type { Config } from '../shared/config.js';
import { resolve } from 'node:path';
import {
  LocalDocumentStorage,
  MAX_DOCUMENT_BYTES,
  validateDocument,
} from '../shared/document-storage.js';
import { HttpError } from '../shared/domain.js';
import { transaction } from '../shared/transaction.js';
export function contractsController(app: FastifyInstance, db: Pool, config: Config) {
  const read = [authenticate(db), allow('admin', 'owner', 'tenant')];
  const write = [authenticate(db), allow('admin')];
  const storage = new LocalDocumentStorage(
    resolve(
      config.PHOTO_STORAGE_DIR ?? resolve(process.cwd(), '.local/property-photos'),
      'financial-documents',
    ),
  );
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
  app.post<{ Params: { id: string } }>(
    '/contracts/:id/payments/generate',
    { preHandler: write },
    (req) => new ContractService(db).ensureInstallments(idSchema.parse(req.params.id), req.user),
  );
  app.post<{ Params: { id: string } }>(
    '/contracts/:id/document',
    { preHandler: write, bodyLimit: MAX_DOCUMENT_BYTES },
    async (req, reply) => {
      const id = idSchema.parse(req.params.id);
      if (!Buffer.isBuffer(req.body)) throw new HttpError(400, 'Selecione um documento.');
      const type = validateDocument(req.body, req.headers['content-type']?.split(';')[0] ?? '');
      const key = await storage.save(req.body, type);
      try {
        const old = await transaction(
          db,
          async (c) => {
            const previous = (
              await c.query(
                'SELECT document_key FROM contracts WHERE id=$1 AND status=$2 FOR UPDATE',
                [id, 'active'],
              )
            ).rows[0];
            if (!previous) throw new HttpError(404, 'Contrato ativo não encontrado.');
            const result = await c.query(
              'UPDATE contracts SET document_key=$2,document_type=$3 WHERE id=$1 AND status=$4',
              [id, key, type, 'active'],
            );
            if (!result.rowCount) throw new HttpError(404, 'Contrato ativo não encontrado.');
            return previous.document_key as string | null;
          },
          req.user.id,
        );
        if (old && old !== key) await storage.remove(old);
        return reply.code(201).send({ url: `/api/contracts/${id}/document` });
      } catch (error) {
        await storage.remove(key);
        throw error;
      }
    },
  );
  app.get<{ Params: { id: string } }>(
    '/contracts/:id/document',
    { preHandler: read },
    async (req, reply) => {
      const id = idSchema.parse(req.params.id);
      await new ContractService(db).detail(id, req.user);
      const row = (
        await db.query('SELECT document_key,document_type FROM contracts WHERE id=$1', [id])
      ).rows[0];
      if (!row?.document_key) throw new HttpError(404, 'Documento não encontrado.');
      return reply
        .header('Content-Disposition', 'attachment; filename="contrato"')
        .type(row.document_type)
        .send(await storage.read(row.document_key));
    },
  );
}
