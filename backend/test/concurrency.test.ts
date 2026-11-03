import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { createPool } from '../src/database/pool.js';
import { migrate } from '../src/database/migrate.js';
import { UserService } from '../src/users/service.js';
import '../src/shared/config.js';

test('RNF001 e arquitetura: cinquenta usuários distintos autenticados consultam simultaneamente', async () => {
  const source = process.env.TEST_DATABASE_URL;
  if (!source || source === process.env.DATABASE_URL || !new URL(source).pathname.endsWith('_test'))
    throw new Error('Exige banco de testes separado terminado em _test.');
  const schema = `suite_${randomBytes(8).toString('hex')}`;
  const admin = createPool(source);
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.end();
  const url = new URL(source);
  url.searchParams.set('options', `-c search_path=${schema},public`);
  const db = createPool(url.toString());
  const origin = 'http://localhost:5173';
  const app = await buildApp(db, {
    DATABASE_URL: source,
    PORT: 3000,
    HOST: '127.0.0.1',
    APP_ORIGIN: origin,
    NODE_ENV: 'test',
    SESSION_HOURS: 8,
  });
  try {
    await migrate(db);
    const service = new UserService(db);
    const sessions: string[] = [];
    for (let i = 0; i < 50; i++) {
      const email = `load-${schema}-${i}@test.example`;
      await service.create({
        name: `Usuário ${i + 1}`,
        email,
        role: 'tenant',
        password: 'Only-for-load-test-42',
      });
      const result = await app.inject({
        method: 'POST',
        url: '/auth/login',
        remoteAddress: `198.18.0.${i + 1}`,
        headers: { origin, 'content-type': 'application/json' },
        payload: JSON.stringify({ email, password: 'Only-for-load-test-42' }),
      });
      assert.equal(result.statusCode, 200, result.body);
      sessions.push(String(result.headers['set-cookie']).split(';')[0]);
    }
    const result = await Promise.all(
      sessions.map(async (cookie, i) => {
        const started = performance.now();
        const response = await app.inject({
          method: 'GET',
          url: '/contracts',
          remoteAddress: `198.18.0.${i + 1}`,
          headers: { cookie },
        });
        assert.equal(response.statusCode, 200, response.body);
        assert.equal(response.json().total, 0);
        return Math.round(performance.now() - started);
      }),
    );
    const sorted = result.toSorted((a, b) => a - b);
    const report = {
      at: new Date().toISOString(),
      users: 50,
      scenario:
        '50 contas e sessões independentes; 50 consultas simultâneas em Fastify inject com PostgreSQL real, sem camada TLS. HTTPS é verificado em teste separado.',
      p95Ms: sorted[47],
      maxMs: sorted[49],
    };
    assert.ok(report.p95Ms <= 3000, `p95 ${report.p95Ms}ms excedeu 3s`);
    console.log(`50 usuários autenticados: p95 ${report.p95Ms}ms; máximo ${report.maxMs}ms`);
  } finally {
    await app.close();
    await db.query(`DROP SCHEMA ${schema} CASCADE`);
    await db.end();
  }
});
