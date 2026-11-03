import type { Pool, PoolClient } from 'pg';
export class PropertyRepository {
  constructor(private db: Pool | PoolClient) {}
  private readonly selection = `p.*,
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', ph.id,
      'url', '/api/properties/' || p.id || '/photos/' || ph.id,
      'content_type', ph.content_type,
      'size_bytes', ph.size_bytes
    ) ORDER BY ph.created_at, ph.id)
    FROM property_photos ph WHERE ph.property_id=p.id), '[]'::jsonb) AS photos`;
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
        `SELECT ${this.selection} FROM properties p ${where} ORDER BY p.created_at DESC,p.id LIMIT 20 OFFSET $5`,
        [...values, (q.page - 1) * 20],
      )
    ).rows;
    return { items, total, page: q.page };
  }
  async byId(id: string, ownerId?: string) {
    return (
      await this.db.query(
        `SELECT ${this.selection} FROM properties p WHERE p.id=$1 AND ($2::uuid IS NULL OR p.owner_id=$2)`,
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
