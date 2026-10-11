import { createHash, randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import type { User } from '../shared/domain.js';
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
export class SessionRepository {
  constructor(private db: Pool) {}
  async create(userId: string, hours: number) {
    const token = randomBytes(32).toString('hex');
    await this.db.query('DELETE FROM sessions WHERE expires_at <= now()');
    await this.db.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+$3 * interval '1 hour')",
      [digest(token), userId, hours],
    );
    return token;
  }
  async user(token: string) {
    return (
      await this.db.query<User>(
        `SELECT u.id,u.name,u.email,u.role,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`,
        [digest(token)],
      )
    ).rows[0];
  }
  async remove(token: string) {
    await this.db.query('DELETE FROM sessions WHERE token_hash=$1', [digest(token)]);
  }
}
