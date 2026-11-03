import type { Pool, PoolClient } from 'pg';
import { HttpError, type User } from '../shared/domain.js';
import { contractCreate, contractPatch, businessToday } from '../shared/rental-validation.js';
import { transaction } from '../shared/transaction.js';
import { ContractRepository } from './repository.js';
export class ContractService {
  constructor(private pool: Pool) {}
  async create(body: unknown, actor: User) {
    const { generate_installments, ...data } = contractCreate.parse(body);
    if (data.end_date < businessToday())
      throw new HttpError(400, 'Um novo contrato ativo não pode ter vigência já encerrada.');
    return transaction(
      this.pool,
      async (client) => {
        const p = (
          await client.query('SELECT owner_id,status FROM properties WHERE id=$1 FOR UPDATE', [
            data.property_id,
          ])
        ).rows[0];
        if (!p) throw new HttpError(400, 'Selecione um imóvel cadastrado.');
        if (p.status !== 'available')
          throw new HttpError(409, 'O imóvel não está disponível para novo contrato.');
        if (p.owner_id !== data.owner_id)
          throw new HttpError(400, 'O proprietário deve corresponder ao cadastro do imóvel.');
        const parties = (
          await client.query(
            'SELECT id,role FROM users WHERE id=ANY($1::uuid[]) AND active FOR SHARE',
            [[data.owner_id, data.tenant_id]],
          )
        ).rows;
        if (
          !parties.some((p) => p.id === data.owner_id && p.role === 'owner') ||
          !parties.some((p) => p.id === data.tenant_id && p.role === 'tenant')
        )
          throw new HttpError(
            400,
            'Informe proprietário e inquilino ativos com os perfis corretos.',
          );
        const created = await new ContractRepository(client).create(data);
        if (generate_installments) await this.generateInstallments(client, created);
        return created;
      },
      actor.id,
    );
  }
  private async generateInstallments(
    client: PoolClient,
    contract: {
      id: string;
      start_date: string | Date;
      end_date: string | Date;
      due_day: number;
      monthly_rent: string;
    },
  ) {
    const day = (value: string | Date) =>
      value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
    const start = day(contract.start_date);
    const end = day(contract.end_date);
    const first = new Date(`${start}T12:00:00Z`);
    let created = 0;
    for (let i = 0; i < 12; i++) {
      const month = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + i, 1, 12));
      const competence = month.toISOString().slice(0, 7);
      if (competence > end.slice(0, 7)) break;
      const lastDay = new Date(
        Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
      ).getUTCDate();
      const dueDate = `${competence}-${String(Math.min(contract.due_day, lastDay)).padStart(2, '0')}`;
      const result = await client.query(
        `INSERT INTO payments(contract_id,competence,amount,due_date)
         VALUES($1,$2::date,$3,$4::date) ON CONFLICT ON CONSTRAINT payments_one_per_competence DO NOTHING`,
        [contract.id, `${competence}-01`, contract.monthly_rent, dueDate],
      );
      created += result.rowCount ?? 0;
    }
    return created;
  }
  async ensureInstallments(id: string, actor: User) {
    return transaction(
      this.pool,
      async (client) => {
        const contract = (
          await client.query('SELECT * FROM contracts WHERE id=$1 FOR UPDATE', [id])
        ).rows[0];
        if (!contract) throw new HttpError(404, 'Contrato não encontrado.');
        return { created: await this.generateInstallments(client, contract) };
      },
      actor.id,
    );
  }
  async update(id: string, body: unknown, actor: User) {
    const data = contractPatch.parse(body);
    return transaction(
      this.pool,
      async (client) => {
        const current = (await client.query('SELECT * FROM contracts WHERE id=$1 FOR UPDATE', [id]))
          .rows[0];
        if (!current) throw new HttpError(404, 'Contrato não encontrado.');
        if (current.status !== 'active')
          throw new HttpError(
            409,
            'Contratos encerrados preservam o histórico e não podem ser alterados.',
          );
        if ((data.end_date ?? current.end_date) < (data.start_date ?? current.start_date))
          throw new HttpError(400, 'O término deve ser igual ou posterior ao início.');
        return new ContractRepository(client).update(id, data);
      },
      actor.id,
    );
  }
  async detail(id: string, user: User) {
    const contract = await new ContractRepository(this.pool).byId(id, user);
    if (!contract) throw new HttpError(404, 'Contrato não encontrado.');
    return contract;
  }
}
