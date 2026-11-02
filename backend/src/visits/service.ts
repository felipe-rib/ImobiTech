import type { Pool } from 'pg';
import { HttpError, type User } from '../shared/domain.js';
import { visitCreate, visitPatch } from '../shared/rental-validation.js';
import { transaction } from '../shared/transaction.js';
import { VisitRepository } from './repository.js';
export class VisitService {
  constructor(private pool: Pool) {}
  private validatePeriod(start: string, end: string) {
    const a = new Date(start).getTime(),
      b = new Date(end).getTime();
    if (a <= Date.now() || b <= a || b - a > 8 * 3600000)
      throw new HttpError(
        400,
        'A visita deve ser futura e terminar após o início, com duração máxima de 8 horas.',
      );
  }
  async create(body: unknown, user: User) {
    const data = visitCreate.parse(body);
    this.validatePeriod(data.starts_at, data.ends_at);
    return transaction(this.pool, async (c) =>
      new VisitRepository(c).create({ ...data, broker_id: user.id }),
    );
  }
  async update(id: string, body: unknown, user: User) {
    const data = visitPatch.parse(body);
    return transaction(this.pool, async (c) => {
      const current = (
        await c.query('SELECT * FROM visits WHERE id=$1 AND broker_id=$2 FOR UPDATE', [id, user.id])
      ).rows[0];
      if (!current) throw new HttpError(404, 'Visita não encontrada.');
      if (current.status === 'cancelled' || new Date(current.starts_at).getTime() <= Date.now())
        throw new HttpError(409, 'Somente visitas futuras e não canceladas podem ser alteradas.');
      if (data.status !== 'cancelled')
        this.validatePeriod(data.starts_at ?? current.starts_at, data.ends_at ?? current.ends_at);
      return new VisitRepository(c).update(id, data);
    });
  }
}
