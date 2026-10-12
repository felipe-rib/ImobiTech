import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Pool } from 'pg';
import { UserRepository } from '../users/repository.js';
import { SessionRepository } from './repository.js';
import { HttpError } from '../shared/domain.js';
const dummyHash = argon2.hash(randomBytes(32), { type: argon2.argon2id });
export class AuthService {
  constructor(private db: Pool) {}
  async login(body: unknown, hours: number) {
    const input = z
      .object({ email: z.email().max(254), password: z.string().min(1).max(128) })
      .strict()
      .safeParse(body);
    if (!input.success) throw new HttpError(401, 'E-mail ou senha inválidos.');
    const user = await new UserRepository(this.db).credentials(input.data.email.toLowerCase());
    const valid = await argon2.verify(
      user?.password_hash ?? (await dummyHash),
      input.data.password,
    );
    if (!user || !valid || !user.active) throw new HttpError(401, 'E-mail ou senha inválidos.');
    const token = await new SessionRepository(this.db).create(user.id, hours);
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
      },
    };
  }
}
