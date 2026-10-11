import type { Pool, PoolClient } from 'pg';
export class PropertyRepository {
  constructor(private db: Pool | PoolClient) {}
  async list(
    q: { search: string; page: number; status?: string; type?: string },
    ownerId?: string,
  ) {
    const values = [`%${q.search}%`, ownerId ?? null, q.status ?? null, q.type ?? null];
    const where =
      'WHERE (title ILIKE $1 OR city ILIKE $1 OR neighborhood ILIKE $1) AND ($2::uuid IS NULL OR owner_id=$2) AND ($3::text IS NULL OR status=$3) AND ($4::text IS NULL OR type=$4)';
    const total = (
      await this.db.query(`SELECT count(*)::int AS total FROM properties ${where}`, values)
    ).rows[0].total;
    const items = (
      await this.db.query(
        `SELECT * FROM properties ${where} ORDER BY created_at DESC,id LIMIT 20 OFFSET $5`,
        [...values, (q.page - 1) * 20],
      )
    ).rows;
    return { items, total, page: q.page };
  }
  async byId(id: string, ownerId?: string) {
    return (
      await this.db.query(
        'SELECT * FROM properties WHERE id=$1 AND ($2::uuid IS NULL OR owner_id=$2)',
        [id, ownerId ?? null],
      )
    ).rows[0];
  }
  async create(data: Record<string, unknown>) {
    return (
      await this.db.query(
        `INSERT INTO properties (${Object.keys(data).join(',')}) VALUES (${Object.keys(data)
          .map((_, i) => `$${i + 1}`)
          .join(',')}) RETURNING *`,
        Object.values(data),
      )
    ).rows[0];
  }
  async update(id: string, data: Record<string, unknown>) {
    return (
      await this.db.query(
        `UPDATE properties SET ${Object.keys(data)
          .map((k, i) => `${k}=$${i + 2}`)
          .join(',')},updated_at=now() WHERE id=$1 RETURNING *`,
        [id, ...Object.values(data)],
      )
    ).rows[0];
  }
  async owners(search: string) {
    return (
      await this.db.query(
        "SELECT id,name FROM users WHERE role='owner' AND active AND name ILIKE $1 ORDER BY name,id LIMIT 50",
        [`%${search}%`],
      )
    ).rows;
  }
}
