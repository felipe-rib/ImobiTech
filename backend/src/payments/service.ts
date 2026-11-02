import type { Pool } from 'pg';
import { HttpError, type User } from '../shared/domain.js';
import { paymentCreate, paymentPatch, businessToday } from '../shared/rental-validation.js';
import { transaction } from '../shared/transaction.js';
import { ContractService } from '../contracts/service.js';
import { PaymentRepository } from './repository.js';
export class PaymentService {
  constructor(private pool: Pool) {}
  async list(contractId: string, user: User, page: number, status?: string) {
    await new ContractService(this.pool).detail(contractId, user);
    return new PaymentRepository(this.pool).list(contractId, page, status);
  }
  async detail(id: string, user: User) {
    const p = await new PaymentRepository(this.pool).byId(id);
    if (!p) throw new HttpError(404, 'Lançamento não encontrado.');
    await new ContractService(this.pool).detail(p.contract_id, user);
    return p;
  }
  async save(body: unknown, actor: User, contractId?: string, id?: string) {
    const data = id ? paymentPatch.parse(body) : paymentCreate.parse(body);
    if (data.paid_at && data.paid_at > businessToday())
      throw new HttpError(400, 'A data de pagamento não pode estar no futuro.');
    return transaction(
      this.pool,
      async (c) => {
        const repo = new PaymentRepository(c);
        const previous = id ? await repo.byId(id) : undefined;
        if (id && !previous) throw new HttpError(404, 'Lançamento não encontrado.');
        const target = contractId ?? previous.contract_id;
        const contract = (await c.query('SELECT * FROM contracts WHERE id=$1 FOR UPDATE', [target]))
          .rows[0];
        if (!contract) throw new HttpError(404, 'Contrato não encontrado.');
        const competence = data.competence ?? previous.competence;
        if (
          competence < contract.start_date.slice(0, 7) ||
          competence > contract.end_date.slice(0, 7)
        )
          throw new HttpError(400, 'A competência deve pertencer à vigência do contrato.');
        const values = {
          ...data,
          ...(data.competence ? { competence: `${data.competence}-01` } : {}),
        };
        return id ? repo.update(id, values) : repo.create({ ...values, contract_id: target });
      },
      actor.id,
    );
  }
}
