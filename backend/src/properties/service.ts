import type { Pool } from 'pg';
import { HttpError, propertySchema, propertyPatchSchema } from '../shared/domain.js';
import { PropertyRepository } from './repository.js';
export class PropertyService {
  constructor(private pool: Pool) {}
  async save(body: unknown, id?: string) {
    const data = id ? propertyPatchSchema.parse(body) : propertySchema.parse(body);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (data.owner_id) {
        const owner = await client.query(
          "SELECT id FROM users WHERE id=$1 AND role='owner' AND active FOR UPDATE",
          [data.owner_id],
        );
        if (!owner.rowCount)
          throw new HttpError(400, 'Selecione um proprietário ativo e cadastrado.');
      }
      const repo = new PropertyRepository(client);
      const property = id
        ? await repo.update(id, data)
        : await repo.create({ ...data, status: 'available' });
      if (!property) throw new HttpError(404, 'Imóvel não encontrado.');
      await client.query('COMMIT');
      return property;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
