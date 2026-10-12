import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import type { Pool } from 'pg';
import type { Config } from './shared/config.js';
import { HttpError } from './shared/domain.js';
import { authController } from './auth/controller.js';
import { usersController } from './users/controller.js';
import { propertiesController } from './properties/controller.js';
export async function buildApp(db: Pool, config: Config) {
  // Production API is reachable only through the single reverse proxy (no published API port).
  const app = Fastify({
    logger: false,
    bodyLimit: 32768,
    trustProxy:
      config.NODE_ENV === 'production' ? (_address: string, hop: number) => hop === 0 : false,
  });
  await app.register(cookie);
  await app.register(helmet);
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
  app.addHook('onRequest', async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      if (req.headers.origin !== new URL(config.APP_ORIGIN).origin)
        throw new HttpError(403, 'Origem da requisição não autorizada.');
      if (req.headers['content-type']?.split(';')[0] !== 'application/json')
        throw new HttpError(415, 'Envie JSON.');
    }
  });
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ZodError)
      return reply
        .code(400)
        .send({
          message: 'Revise os campos informados.',
          fields: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
        });
    if (error instanceof HttpError)
      return reply.code(error.statusCode).send({ message: error.message });
    const e = error as { code?: string; statusCode?: number };
    if (e.code === '23505')
      return reply.code(409).send({ message: 'E-mail ou identificação já cadastrados.' });
    if (e.code === '23514' || e.code === '23503')
      return reply
        .code(409)
        .send({
          message:
            'A alteração viola um vínculo ou regra do cadastro. Proprietários com imóveis devem manter esse perfil.',
        });
    if (e.statusCode && e.statusCode < 500)
      return reply
        .code(e.statusCode)
        .send({
          message:
            e.statusCode === 429
              ? 'Muitas tentativas. Aguarde e tente novamente.'
              : 'Requisição inválida.',
        });
    // Do not log SQL, request payloads, cookies or personal data.
    console.error(
      JSON.stringify({ event: 'request_failed', requestId: req.id, code: e.code ?? 'INTERNAL' }),
    );
    return reply
      .code(500)
      .send({ message: 'Não foi possível concluir a operação. Tente novamente.' });
  });
  app.get('/health', async () => {
    await db.query('SELECT 1');
    return { status: 'ok' };
  });
  authController(app, db, config);
  usersController(app, db);
  propertiesController(app, db);
  return app;
}
