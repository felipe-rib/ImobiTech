import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { Config } from '../shared/config.js';
import { AuthService } from './service.js';
import { SessionRepository } from './repository.js';
import { authenticate } from './guards.js';
export function authController(app: FastifyInstance, db: Pool, config: Config) {
  const cookie = {
    path: '/',
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'strict' as const,
  };
  app.post(
    '/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const { token, user } = await new AuthService(db).login(req.body, config.SESSION_HOURS);
      if (req.cookies.imobitech_session)
        await new SessionRepository(db).remove(req.cookies.imobitech_session);
      return reply
        .setCookie('imobitech_session', token, { ...cookie, maxAge: config.SESSION_HOURS * 3600 })
        .send(user);
    },
  );
  app.get('/auth/me', { preHandler: authenticate(db) }, async (req) => req.user);
  app.post('/auth/logout', { preHandler: authenticate(db) }, async (req, reply) => {
    await new SessionRepository(db).remove(req.cookies.imobitech_session!);
    return reply.clearCookie('imobitech_session', cookie).code(204).send();
  });
}
