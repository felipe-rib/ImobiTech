import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/app.js';
import { createPool } from '../src/database/pool.js';
import { migrate } from '../src/database/migrate.js';
import { UserService } from '../src/users/service.js';
import { PropertyService } from '../src/properties/service.js';
import '../src/shared/config.js';

test('Fotos de imóveis: upload, persistência, limites, isolamento e remoção', async () => {
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
  const directory = await mkdtemp(join(tmpdir(), 'imobitech-photos-'));
  const origin = 'http://localhost:5173';
  const config = {
    DATABASE_URL: source,
    PORT: 3000,
    HOST: '127.0.0.1',
    APP_ORIGIN: origin,
    NODE_ENV: 'test' as const,
    SESSION_HOURS: 8,
    PHOTO_STORAGE_DIR: directory,
  };
  let app = await buildApp(db, config);
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l5sAAAAASUVORK5CYII=',
    'base64',
  );
  try {
    await migrate(db);
    const users = new UserService(db);
    const password = 'Photo-test-password-42';
    const create = (role: 'admin' | 'broker' | 'owner' | 'tenant', suffix: string) =>
      users.create({ name: `Teste ${suffix}`, email: `${suffix}@test.example`, role, password });
    const administrator = await create('admin', 'admin');
    await create('broker', 'broker');
    const owner = await create('owner', 'owner');
    await create('owner', 'other-owner');
    await create('tenant', 'tenant');
    const property = await new PropertyService(db).save({
      title: 'Imóvel com fotos',
      type: 'apartment',
      street: 'Rua Teste',
      number: '1',
      neighborhood: 'Centro',
      city: 'Brasília',
      state: 'DF',
      postal_code: '70000000',
      owner_id: owner.id,
    });
    const cookies: Record<string, string> = {};
    for (const role of ['admin', 'broker', 'owner', 'other-owner', 'tenant']) {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { origin, 'content-type': 'application/json' },
        payload: JSON.stringify({ email: `${role}@test.example`, password }),
      });
      assert.equal(response.statusCode, 200);
      cookies[role] = String(response.headers['set-cookie']).split(';')[0];
    }
    const path = `/properties/${property.id}/photos`;
    const upload = (cookie: string, body: Buffer, type = 'image/png') =>
      app.inject({
        method: 'POST',
        url: path,
        headers: { origin, cookie, 'content-type': type },
        payload: body,
      });
    assert.equal((await upload(cookies.owner, png)).statusCode, 403);
    assert.equal((await upload(cookies.tenant, png)).statusCode, 403);
    assert.equal((await upload(cookies.admin, Buffer.from('not an image'))).statusCode, 400);
    assert.equal((await upload(cookies.admin, png, 'image/jpeg')).statusCode, 400);
    assert.equal((await upload(cookies.admin, Buffer.alloc(5 * 1024 * 1024 + 1))).statusCode, 413);
    const created = await upload(cookies.admin, png);
    assert.equal(created.statusCode, 201, created.body);
    const photo = created.json();
    assert.equal((await readdir(directory)).length, 1);
    const detail = await app.inject({
      method: 'GET',
      url: `/properties/${property.id}`,
      headers: { cookie: cookies.owner },
    });
    assert.equal(detail.json().photos[0].id, photo.id);
    const list = await app.inject({
      method: 'GET',
      url: '/properties',
      headers: { cookie: cookies.owner },
    });
    assert.equal(list.json().items[0].photos[0].url, photo.url);
    assert.equal(
      (
        await app.inject({
          method: 'GET',
          url: photo.url.replace('/api', ''),
          headers: { cookie: cookies['other-owner'] },
        })
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await app.inject({
          method: 'GET',
          url: photo.url.replace('/api', ''),
          headers: { cookie: cookies.tenant },
        })
      ).statusCode,
      403,
    );
    const fetched = await app.inject({
      method: 'GET',
      url: photo.url.replace('/api', ''),
      headers: { cookie: cookies.owner },
    });
    assert.equal(fetched.statusCode, 200);
    assert.equal(fetched.headers['content-type'], 'image/png');
    assert.deepEqual(fetched.rawPayload, png);
    await app.close();
    app = await buildApp(db, config);
    const afterRestart = await app.inject({
      method: 'GET',
      url: photo.url.replace('/api', ''),
      headers: { cookie: cookies.owner },
    });
    assert.equal(afterRestart.statusCode, 200);
    for (let i = 1; i < 10; i++) assert.equal((await upload(cookies.broker, png)).statusCode, 201);
    assert.equal((await upload(cookies.admin, png)).statusCode, 409);
    const removed = await app.inject({
      method: 'DELETE',
      url: photo.url.replace('/api', ''),
      headers: { origin, cookie: cookies.admin, 'content-type': 'application/json' },
      payload: '{}',
    });
    assert.equal(removed.statusCode, 204);
    assert.equal((await readdir(directory)).length, 9);
    assert.equal(
      (
        await app.inject({
          method: 'GET',
          url: photo.url.replace('/api', ''),
          headers: { cookie: cookies.owner },
        })
      ).statusCode,
      404,
    );
    assert.equal(administrator.role, 'admin');
  } finally {
    await app.close();
    await db.query(`DROP SCHEMA ${schema} CASCADE`);
    await db.end();
    await rm(directory, { recursive: true, force: true });
  }
});
