import argon2 from 'argon2';
import type { Pool } from 'pg';
import { HttpError, userSchema, userPatchSchema } from '../shared/domain.js';
import { UserRepository } from './repository.js';
export class UserService {
  constructor(private pool: Pool) {}
  async create(body: unknown) {
    const { password, ...data } = userSchema.parse(body);
    return new UserRepository(this.pool).create({
      ...data,
      password_hash: await argon2.hash(password, { type: argon2.argon2id }),
    });
  }
  async update(id: string, body: unknown) {
    const { password, ...data } = userPatchSchema.parse(body);
    const changes: Record<string, unknown> = { ...data };
    if (password) changes.password_hash = await argon2.hash(password, { type: argon2.argon2id });
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize administrator changes to preserve at least one active administrator.
      await client.query('SELECT pg_advisory_xact_lock(100602)');
      const previous = (
        await client.query('SELECT role,active FROM users WHERE id=$1 FOR UPDATE', [id])
      ).rows[0];
      if (!previous) throw new HttpError(404, 'Usuário não encontrado.');
      if (
        previous.role === 'admin' &&
        previous.active &&
        (data.active === false || (data.role && data.role !== 'admin'))
      ) {
        const count = (
          await client.query(
            "SELECT count(*)::int AS total FROM users WHERE role='admin' AND active",
          )
        ).rows[0].total;
        if (count <= 1) throw new HttpError(409, 'Mantenha ao menos um administrador ativo.');
      }
      const user = await new UserRepository(client).update(id, changes);
      if (password || data.role !== undefined || data.active !== undefined)
        await client.query('DELETE FROM sessions WHERE user_id=$1', [id]);
      await client.query('COMMIT');
      return user;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
