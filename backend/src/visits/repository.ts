import type { Pool, PoolClient } from 'pg';
import type { User } from '../shared/domain.js';
import type { RentalQuery } from '../contracts/repository.js';
export class VisitRepository {
  constructor(private db: Pool | PoolClient) {}
  async list(q: RentalQuery, user: User) {
    const values = [`%${q.search}%`, user.role === 'broker' ? user.id : null, q.status ?? null];
    const base = `FROM visits v JOIN properties p ON p.id=v.property_id JOIN users u ON u.id=v.broker_id WHERE (p.title ILIKE $1 OR v.participant_name ILIKE $1) AND ($2::uuid IS NULL OR v.broker_id=$2) AND ($3::text IS NULL OR v.status=$3)`;
    const total = (await this.db.query(`SELECT count(*)::int AS total ${base}`, values)).rows[0]
      .total;
    const items = (
      await this.db.query(
        `SELECT v.*,p.title AS property_title,u.name AS broker_name ${base} ORDER BY v.starts_at DESC,v.id LIMIT 20 OFFSET $4`,
        [...values, (q.page - 1) * 20],
      )
    ).rows;
    return { items, total, page: q.page };
  }
  async create(data: Record<string, unknown>) {
    const keys = Object.keys(data);
    return (
      await this.db.query(
        `INSERT INTO visits (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
        Object.values(data),
      )
    ).rows[0];
  }
  async update(id: string, data: Record<string, unknown>) {
    return (
      await this.db.query(
        `UPDATE visits SET ${Object.keys(data)
          .map((key, i) => `${key}=$${i + 2}`)
          .join(',')} WHERE id=$1 RETURNING *`,
        [id, ...Object.values(data)],
      )
    ).rows[0];
  }
}
