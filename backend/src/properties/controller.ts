import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { authenticate, allow } from '../auth/guards.js';
import { HttpError, idSchema, listSchema } from '../shared/domain.js';
import type { Config } from '../shared/config.js';
import { resolve } from 'node:path';
import { PropertyRepository } from './repository.js';
import { PropertyService } from './service.js';
import {
  LocalPhotoStorage,
  MAX_PHOTO_BYTES,
  MAX_PROPERTY_PHOTOS,
  validatePhoto,
} from './photo-storage.js';
export function propertiesController(app: FastifyInstance, db: Pool, config: Config) {
  const read = [authenticate(db), allow('admin', 'broker', 'owner')];
  const write = [authenticate(db), allow('admin', 'broker')];
  const storage = new LocalPhotoStorage(
    config.PHOTO_STORAGE_DIR ?? resolve(process.cwd(), '.local/property-photos'),
  );
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
  app.post<{ Params: { id: string } }>(
    '/properties/:id/photos',
    { preHandler: write, bodyLimit: MAX_PHOTO_BYTES },
    async (req, reply) => {
      const propertyId = idSchema.parse(req.params.id);
      if (!Buffer.isBuffer(req.body)) throw new HttpError(400, 'Selecione uma foto válida.');
      const type = validatePhoto(req.body, req.headers['content-type']?.split(';')[0] ?? '');
      const client = await db.connect();
      let key: string | undefined;
      try {
        await client.query('BEGIN');
        const property = await client.query('SELECT id FROM properties WHERE id=$1 FOR UPDATE', [
          propertyId,
        ]);
        if (!property.rowCount) throw new HttpError(404, 'Imóvel não encontrado.');
        const count = await client.query(
          'SELECT count(*)::int AS total FROM property_photos WHERE property_id=$1',
          [propertyId],
        );
        if (count.rows[0].total >= MAX_PROPERTY_PHOTOS)
          throw new HttpError(409, 'Limite de 10 fotos por imóvel.');
        key = await storage.save(req.body, type);
        const saved = await client.query(
          'INSERT INTO property_photos(property_id,content_type,size_bytes,storage_key) VALUES($1,$2,$3,$4) RETURNING id',
          [propertyId, type, req.body.length, key],
        );
        await client.query('COMMIT');
        return reply.code(201).send({
          id: saved.rows[0].id,
          url: `/api/properties/${propertyId}/photos/${saved.rows[0].id}`,
          content_type: type,
          size_bytes: req.body.length,
        });
      } catch (error) {
        await client.query('ROLLBACK');
        if (key) await storage.remove(key);
        throw error;
      } finally {
        client.release();
      }
    },
  );
  app.get<{ Params: { id: string; photoId: string } }>(
    '/properties/:id/photos/:photoId',
    { preHandler: read },
    async (req, reply) => {
      const propertyId = idSchema.parse(req.params.id);
      const photoId = idSchema.parse(req.params.photoId);
      const property = await new PropertyRepository(db).byId(
        propertyId,
        req.user.role === 'owner' ? req.user.id : undefined,
      );
      if (!property) throw new HttpError(404, 'Imóvel não encontrado.');
      const result = await db.query(
        'SELECT storage_key,content_type FROM property_photos WHERE id=$1 AND property_id=$2',
        [photoId, propertyId],
      );
      if (!result.rowCount) throw new HttpError(404, 'Foto não encontrada.');
      try {
        const bytes = await storage.read(result.rows[0].storage_key);
        return reply.type(result.rows[0].content_type).send(bytes);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT')
          throw new HttpError(503, 'Arquivo da foto indisponível.');
        throw error;
      }
    },
  );
  app.delete<{ Params: { id: string; photoId: string } }>(
    '/properties/:id/photos/:photoId',
    { preHandler: write },
    async (req, reply) => {
      const propertyId = idSchema.parse(req.params.id);
      const photoId = idSchema.parse(req.params.photoId);
      const result = await db.query(
        'DELETE FROM property_photos WHERE id=$1 AND property_id=$2 RETURNING storage_key',
        [photoId, propertyId],
      );
      if (!result.rowCount) throw new HttpError(404, 'Foto não encontrada.');
      await storage.remove(result.rows[0].storage_key);
      return reply.code(204).send();
    },
  );
}
