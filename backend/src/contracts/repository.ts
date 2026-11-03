import type { Pool, PoolClient } from 'pg';
import type { User } from '../shared/domain.js';
export type RentalQuery = { search: string; page: number; status?: string };
export const contractSelect = `SELECT c.*,p.title AS property_title,o.name AS owner_name,t.name AS tenant_name
 FROM contracts c JOIN properties p ON p.id=c.property_id JOIN users o ON o.id=c.owner_id JOIN users t ON t.id=c.tenant_id`;
export function contractScope(user: User) {
  return {
    owner: user.role === 'owner' ? user.id : null,
    tenant: user.role === 'tenant' ? user.id : null,
  };
}
export class ContractRepository {
  constructor(private db: Pool | PoolClient) {}
  async byId(id: string, user: User) {
    const scope = contractScope(user);
    return (
      await this.db.query(
        `${contractSelect} WHERE c.id=$1 AND ($2::uuid IS NULL OR c.owner_id=$2) AND ($3::uuid IS NULL OR c.tenant_id=$3)`,
        [id, scope.owner, scope.tenant],
      )
    ).rows[0];
  }
  async list(query: RentalQuery, user: User) {
    const scope = contractScope(user);
    const values = [`%${query.search}%`, scope.owner, scope.tenant, query.status ?? null];
    const where = `WHERE (p.title ILIKE $1 OR o.name ILIKE $1 OR t.name ILIKE $1) AND ($2::uuid IS NULL OR c.owner_id=$2) AND ($3::uuid IS NULL OR c.tenant_id=$3) AND ($4::text IS NULL OR c.status=$4)`;
    const total = (
      await this.db.query(
        `SELECT count(*)::int AS total FROM (${contractSelect} ${where}) matches`,
        values,
      )
    ).rows[0].total;
    const items = (
      await this.db.query(
        `${contractSelect} ${where} ORDER BY c.created_at DESC,c.id LIMIT 20 OFFSET $5`,
        [...values, (query.page - 1) * 20],
      )
    ).rows;
    return { items, total, page: query.page };
  }
  async create(data: Record<string, unknown>) {
    const keys = Object.keys(data);
    return (
      await this.db.query(
        `INSERT INTO contracts (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
        Object.values(data),
      )
    ).rows[0];
  }
  async update(id: string, data: Record<string, unknown>) {
    return (
      await this.db.query(
        `UPDATE contracts SET ${Object.keys(data)
          .map((key, i) => `${key}=$${i + 2}`)
          .join(',')} WHERE id=$1 RETURNING *`,
        [id, ...Object.values(data)],
      )
    ).rows[0];
  }
  async options(kind: 'properties' | 'tenants', search: string) {
    if (kind === 'tenants')
      return (
        await this.db.query(
          "SELECT id,name,email FROM users WHERE role='tenant' AND active AND (name ILIKE $1 OR email ILIKE $1) ORDER BY name,id LIMIT 50",
          [`%${search}%`],
        )
      ).rows;
    return (
      await this.db.query(
        "SELECT p.id,p.title AS name,p.rent,p.owner_id,u.name AS owner_name FROM properties p JOIN users u ON u.id=p.owner_id WHERE p.status='available' AND u.active AND (p.title ILIKE $1 OR p.city ILIKE $1 OR p.neighborhood ILIKE $1 OR p.street ILIKE $1) ORDER BY p.title,p.id LIMIT 50",
        [`%${search}%`],
      )
    ).rows;
  }
  async history(id: string) {
    return (
      await this.db.query(
        `SELECT a.id,a.entity_type,a.entity_id,a.action,a.occurred_at,u.name AS actor_name,a.before_data,a.after_data
 FROM audit_events a JOIN users u ON u.id=a.actor_id WHERE (a.entity_type='contract' AND a.entity_id=$1) OR
 (a.entity_type='payment' AND a.entity_id IN(SELECT id FROM payments WHERE contract_id=$1)) ORDER BY a.occurred_at DESC,a.id DESC`,
        [id],
      )
    ).rows;
  }
}
