import type { Pool, PoolClient } from 'pg';
export const paymentStatus =
  "CASE WHEN paid_at IS NOT NULL THEN 'paid' WHEN due_date < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 'overdue' ELSE 'pending' END";
export const paymentColumns = `id,contract_id,to_char(competence,'YYYY-MM') AS competence,amount,due_date,paid_at,review_status,submitted_at,(proof_key IS NOT NULL) AS has_proof,created_at,updated_at,${paymentStatus} AS status`;
export class PaymentRepository {
  constructor(private db: Pool | PoolClient) {}
  async byId(id: string) {
    return (await this.db.query(`SELECT ${paymentColumns} FROM payments WHERE id=$1`, [id]))
      .rows[0];
  }
  async list(contractId: string, page: number, status?: string) {
    const args = [contractId, status ?? null];
    const where = `WHERE contract_id=$1 AND ($2::text IS NULL OR (${paymentStatus})=$2)`;
    const items = (
      await this.db.query(
        `SELECT ${paymentColumns} FROM payments ${where} ORDER BY competence ASC,id LIMIT 20 OFFSET $3`,
        [...args, (page - 1) * 20],
      )
    ).rows;
    const total = (
      await this.db.query(`SELECT count(*)::int AS total FROM payments ${where}`, args)
    ).rows[0].total;
    // Summary covers the whole selected contract, independent of pagination and filters.
    const summary = (
      await this.db.query(
        `SELECT COALESCE(sum(amount) FILTER(WHERE paid_at IS NOT NULL),0)::text AS paid,
   COALESCE(sum(amount) FILTER(WHERE paid_at IS NULL),0)::text AS pending,
   COALESCE(sum(amount) FILTER(WHERE paid_at IS NULL AND due_date<(now() AT TIME ZONE 'America/Sao_Paulo')::date),0)::text AS overdue
   FROM payments WHERE contract_id=$1`,
        [contractId],
      )
    ).rows[0];
    return { items, total, page, summary };
  }
  async create(data: Record<string, unknown>) {
    const keys = Object.keys(data);
    return (
      await this.db.query(
        `INSERT INTO payments (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING ${paymentColumns}`,
        Object.values(data),
      )
    ).rows[0];
  }
  async update(id: string, data: Record<string, unknown>) {
    return (
      await this.db.query(
        `UPDATE payments SET ${Object.keys(data)
          .map((key, i) => `${key}=$${i + 2}`)
          .join(',')} WHERE id=$1 RETURNING ${paymentColumns}`,
        [id, ...Object.values(data)],
      )
    ).rows[0];
  }
}
