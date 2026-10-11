import type { Pool, PoolClient } from 'pg';
import type { User } from '../shared/domain.js';
export const userColumns = 'id,name,email,identifier,phone,role,active,created_at,updated_at';
export class UserRepository {
  constructor(private db: Pool | PoolClient) {}
  async byId(id: string) {
    return (await this.db.query<User>(`SELECT ${userColumns} FROM users WHERE id=$1`, [id]))
      .rows[0];
  }
  async credentials(email: string) {
    return (
      await this.db.query<User & { password_hash: string }>(
        `SELECT ${userColumns},password_hash FROM users WHERE email=$1`,
        [email],
      )
    ).rows[0];
  }
  async list(q: { search: string; page: number; role?: string; active?: string }) {
    const values = [`%${q.search}%`, q.role ?? null, q.active ?? null];
    const where =
      'WHERE (name ILIKE $1 OR email ILIKE $1) AND ($2::text IS NULL OR role=$2) AND ($3::boolean IS NULL OR active=$3::boolean)';
    const total = (await this.db.query(`SELECT count(*)::int AS total FROM users ${where}`, values))
      .rows[0].total;
    const items = (
      await this.db.query(
        `SELECT ${userColumns} FROM users ${where} ORDER BY created_at DESC,id LIMIT 20 OFFSET $4`,
        [...values, (q.page - 1) * 20],
      )
    ).rows;
    return { items, total, page: q.page };
  }
  async create(data: Record<string, unknown>) {
    const keys = Object.keys(data);
    return (
      await this.db.query<User>(
        `INSERT INTO users (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING ${userColumns}`,
        Object.values(data),
      )
    ).rows[0];
  }
  async update(id: string, data: Record<string, unknown>) {
    return (
      await this.db.query<User>(
        `UPDATE users SET ${Object.keys(data)
          .map((k, i) => `${k}=$${i + 2}`)
          .join(',')},updated_at=now() WHERE id=$1 RETURNING ${userColumns}`,
        [id, ...Object.values(data)],
      )
    ).rows[0];
  }
}
