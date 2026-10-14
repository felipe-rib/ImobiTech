import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { createPool } from '../src/database/pool.js';
import { migrate } from '../src/database/migrate.js';
import '../src/shared/config.js';
import { UserService } from '../src/users/service.js';
const url = process.env.TEST_DATABASE_URL;
if (!url)
  throw new Error(
    'Defina TEST_DATABASE_URL para um banco de teste separado. Nenhum teste foi executado.',
  );
if (url === process.env.DATABASE_URL || !new URL(url).pathname.endsWith('_test'))
  throw new Error('O banco de testes deve ser separado e ter nome terminado em _test.');
const pool = createPool(url);
const schema = `suite_${randomBytes(8).toString('hex')}`;
// Each suite has an isolated schema; no existing application tables are truncated.
await pool.query(`CREATE SCHEMA ${schema}`);
await pool.end();
const testUrl = new URL(url);
testUrl.searchParams.set('options', `-c search_path=${schema},public`);
const db = createPool(testUrl.toString());
const origin = 'http://localhost:5173';
const app = await buildApp(db, {
  DATABASE_URL: url,
  PORT: 3000,
  HOST: '127.0.0.1',
  APP_ORIGIN: origin,
  NODE_ENV: 'test',
  SESSION_HOURS: 8,
});
const password = 'Integration-only-password-42';
let adminId: string;
let brokerId: string;
let ownerId: string;
let owner2Id: string;
let tenantId: string;
const cookies: Record<string, string> = {};
let propertyId: string;
const request = async (
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  role?: string,
  payload?: unknown,
) =>
  app.inject({
    method,
    url: path,
    headers: {
      origin,
      'content-type': 'application/json',
      ...(role ? { cookie: cookies[role] } : {}),
    },
    ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}),
  });
const property = (owner_id: string) => ({
  title: 'Apartamento de integração',
  type: 'apartment',
  street: 'Rua de teste',
  number: '10',
  neighborhood: 'Centro',
  city: 'Brasília',
  state: 'DF',
  postal_code: '70000000',
  rent: 1800.5,
  owner_id,
});
before(async () => {
  await migrate(db);
  await migrate(db);
  const service = new UserService(db);
  adminId = (
    await service.create({
      name: 'Admin Teste',
      email: 'admin@test.example',
      role: 'admin',
      password,
    })
  ).id;
  brokerId = (
    await service.create({
      name: 'Corretor Teste',
      email: 'broker@test.example',
      role: 'broker',
      password,
    })
  ).id;
  ownerId = (
    await service.create({
      name: 'Proprietário Um',
      email: 'owner@test.example',
      role: 'owner',
      password,
    })
  ).id;
  owner2Id = (
    await service.create({
      name: 'Proprietário Dois',
      email: 'owner2@test.example',
      role: 'owner',
      password,
    })
  ).id;
  tenantId = (
    await service.create({
      name: 'Inquilino Teste',
      email: 'tenant@test.example',
      role: 'tenant',
      password,
    })
  ).id;
  await service.create({
    name: 'Inativo Teste',
    email: 'inactive@test.example',
    role: 'tenant',
    active: false,
    password,
  });
});
after(async () => {
  await app.close();
  await db.query(`DROP SCHEMA ${schema} CASCADE`);
  await db.end();
});
test('T1.01 / T1.02: quatro perfis autenticam e recebem somente dados públicos', async () => {
  for (const role of ['admin', 'broker', 'owner', 'owner2', 'tenant']) {
    const r = await request('POST', '/auth/login', undefined, {
      email: `${role}@test.example`,
      password,
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.ok(!r.body.includes('password'));
    const setCookie = String(r.headers['set-cookie']);
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    cookies[role] = setCookie.split(';')[0];
    const me = await request('GET', '/auth/me', role);
    assert.equal(me.statusCode, 200);
    assert.equal(me.json().email, `${role}@test.example`);
  }
});
test('T1.03 / T1.04: credenciais inválidas e inativo retornam erro genérico idêntico', async () => {
  const responses = [];
  for (const [email, pass] of [
    ['admin@test.example', 'wrong'],
    ['missing@test.example', password],
    ['inactive@test.example', password],
  ]) {
    const r = await request('POST', '/auth/login', undefined, { email, password: pass });
    assert.equal(r.statusCode, 401);
    responses.push(r.body);
  }
  assert.equal(new Set(responses).size, 1);
});
test('T1.05: administrador cadastra usuário e persiste no PostgreSQL', async () => {
  const r = await request('POST', '/users', 'admin', {
    name: 'Novo Usuário',
    email: 'new@test.example',
    role: 'tenant',
    password,
    identifier: 'UNICO-001',
  });
  assert.equal(r.statusCode, 201, r.body);
  assert.ok(!r.body.includes('hash'));
  const result = await db.query('SELECT name FROM users WHERE id=$1', [r.json().id]);
  assert.equal(result.rows[0].name, 'Novo Usuário');
});
test('T1.06 / T1.07: atualização e perfil persistem; sessão anterior é revogada', async () => {
  const r = await request('PATCH', `/users/${tenantId}`, 'admin', {
    name: 'Nome Atualizado',
    role: 'broker',
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal((await request('GET', `/users/${tenantId}`, 'admin')).json().role, 'broker');
  assert.equal((await request('GET', '/auth/me', 'tenant')).statusCode, 401);
  await request('PATCH', `/users/${tenantId}`, 'admin', { role: 'tenant' });
  const login = await request('POST', '/auth/login', undefined, {
    email: 'tenant@test.example',
    password,
  });
  cookies.tenant = String(login.headers['set-cookie']).split(';')[0];
});
test('T1.08 / T1.15: rotas protegidas retornam 401 e perfis sem permissão recebem 403', async () => {
  for (const path of [
    '/auth/me',
    '/users',
    `/users/${adminId}`,
    '/properties',
    `/properties/${adminId}`,
  ])
    assert.equal((await request('GET', path)).statusCode, 401, path);
  for (const role of ['broker', 'owner', 'tenant']) {
    assert.equal((await request('GET', '/users', role)).statusCode, 403);
    assert.equal((await request('POST', '/users', role, {})).statusCode, 403);
    assert.equal((await request('PATCH', `/users/${adminId}`, role, {})).statusCode, 403);
    assert.equal((await request('GET', `/users/${adminId}`, role)).statusCode, 403);
  }
  assert.equal((await request('GET', '/properties', 'tenant')).statusCode, 403);
  for (const role of ['owner', 'tenant'])
    assert.equal((await request('POST', '/properties', role, property(ownerId))).statusCode, 403);
});
test('T1.09: e-mail e identificador únicos; perfil inválido e campos extras rejeitados', async () => {
  for (const data of [
    { email: 'ADMIN@test.example' },
    { email: 'unique@test.example', identifier: 'UNICO-001' },
  ]) {
    const r = await request('POST', '/users', 'admin', {
      name: 'Duplicado Teste',
      role: 'tenant',
      password,
      ...data,
    });
    assert.equal(r.statusCode, 409, r.body);
  }
  assert.equal(
    (
      await request('POST', '/users', 'admin', {
        name: 'Inválido',
        email: 'invalid@test.example',
        password,
        role: ['admin', 'owner'],
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (await request('PATCH', `/users/${brokerId}`, 'admin', { password_hash: 'injected' }))
      .statusCode,
    400,
  );
});
test('T1.10 / T1.13: corretor cria imóvel com situação Disponível e vínculo real', async () => {
  const r = await request('POST', '/properties', 'broker', property(ownerId));
  assert.equal(r.statusCode, 201, r.body);
  propertyId = r.json().id;
  assert.equal(r.json().status, 'available');
  assert.equal(
    (await db.query('SELECT owner_id FROM properties WHERE id=$1', [propertyId])).rows[0].owner_id,
    ownerId,
  );
  assert.equal(
    (await request('POST', '/properties', 'admin', { ...property(ownerId), status: 'unavailable' }))
      .statusCode,
    400,
  );
});
test('T1.11: alteração do imóvel persiste e aparece na consulta', async () => {
  assert.equal(
    (
      await request('PATCH', `/properties/${propertyId}`, 'broker', {
        title: 'Título atualizado',
        rent: 2150.75,
        status: 'unavailable',
      })
    ).statusCode,
    200,
  );
  const r = await request('GET', `/properties/${propertyId}`, 'admin');
  assert.equal(r.json().title, 'Título atualizado');
  assert.equal(r.json().rent, '2150.75');
  assert.equal(r.json().status, 'unavailable');
});
test('T1.12: proprietário obrigatório, existente, ativo e com perfil correto', async () => {
  for (const owner of [undefined, '00000000-0000-4000-8000-000000000001', brokerId])
    assert.equal(
      (await request('POST', '/properties', 'admin', property(owner as string))).statusCode,
      400,
    );
  assert.equal(
    (await request('PATCH', `/users/${ownerId}`, 'admin', { role: 'broker' })).statusCode,
    409,
  );
  assert.equal(
    (await request('PATCH', `/properties/${propertyId}`, 'admin', { owner_id: brokerId }))
      .statusCode,
    400,
  );
});
test('T1.16: proprietário consulta somente seus imóveis e não pode editá-los', async () => {
  assert.equal((await request('GET', '/properties', 'owner')).json().total, 1);
  assert.equal((await request('GET', '/properties', 'owner2')).json().total, 0);
  assert.equal((await request('GET', `/properties/${propertyId}`, 'owner2')).statusCode, 404);
  assert.equal((await request('GET', `/properties/${propertyId}`, 'owner')).statusCode, 200);
  assert.equal(
    (await request('PATCH', `/properties/${propertyId}`, 'owner', { title: 'Não autorizado' }))
      .statusCode,
    403,
  );
  assert.equal((await request('GET', '/properties/owners', 'owner')).statusCode, 403);
  const owners = await request('GET', '/properties/owners', 'broker');
  assert.ok(owners.json().length > 0);
  assert.deepEqual(Object.keys(owners.json()[0]).sort(), ['id', 'name']);
});
test('T1.17: Argon2id no banco; hashes ausentes em todas as respostas de usuários', async () => {
  const hash = (await db.query('SELECT password_hash FROM users WHERE id=$1', [adminId])).rows[0]
    .password_hash;
  assert.match(hash, /^\$argon2id\$/);
  assert.ok(await argon2.verify(hash, password));
  assert.ok(!(await request('GET', '/users', 'admin')).body.includes('password'));
  assert.ok(!(await request('GET', `/users/${adminId}`, 'admin')).body.includes('password'));
  const sessions = await db.query('SELECT token_hash FROM sessions');
  assert.ok(
    sessions.rows.every((r) => !Object.values(cookies).some((c) => c.includes(r.token_hash))),
  );
});
test('Filtros, paginação, validação e consultas parametrizadas', async () => {
  assert.equal((await request('GET', '/users?role=owner&active=true', 'admin')).json().total, 2);
  assert.equal((await request('GET', '/users?page=999', 'admin')).json().items.length, 0);
  assert.equal(
    (
      await request('GET', `/properties?search=${encodeURIComponent("' OR 1=1 --")}`, 'admin')
    ).json().total,
    0,
  );
  assert.equal((await request('GET', '/properties?status=unavailable', 'admin')).json().total, 1);
  assert.equal((await request('GET', '/properties/not-a-uuid', 'admin')).statusCode, 400);
  assert.equal((await request('PATCH', `/properties/${propertyId}`, 'admin', {})).statusCode, 400);
});
test('CSRF: rejeita origem externa e ausente em mutações', async () => {
  for (const headers of [{ origin: 'https://evil.example' }, {}]) {
    const r = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { ...headers, cookie: cookies.admin, 'content-type': 'application/json' },
      payload: '{}',
    });
    assert.equal(r.statusCode, 403);
  }
});
test('Último administrador é preservado; desativação invalida sessão', async () => {
  assert.equal(
    (await request('PATCH', `/users/${adminId}`, 'admin', { active: false })).statusCode,
    409,
  );
  assert.equal(
    (await request('PATCH', `/users/${brokerId}`, 'admin', { active: false })).statusCode,
    200,
  );
  assert.equal((await request('GET', '/auth/me', 'broker')).statusCode, 401);
  assert.equal(
    (
      await request('PATCH', `/users/${brokerId}`, 'admin', { name: 'Corretor ainda inativo' })
    ).json().active,
    false,
  );
});
test('T1.14 parcial: cookie Secure em produção e cabeçalhos de proteção', async () => {
  const production = await buildApp(db, {
    DATABASE_URL: url,
    PORT: 3000,
    HOST: '127.0.0.1',
    APP_ORIGIN: 'https://localhost',
    NODE_ENV: 'production',
    SESSION_HOURS: 8,
  });
  try {
    const r = await production.inject({
      method: 'POST',
      url: '/auth/login',
      headers: {
        origin: 'https://localhost',
        'content-type': 'application/json',
        'x-forwarded-proto': 'https',
      },
      payload: JSON.stringify({ email: 'admin@test.example', password }),
    });
    assert.equal(r.statusCode, 200);
    assert.match(String(r.headers['set-cookie']), /; Secure/);
    assert.equal(r.headers['cache-control'], 'no-store');
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
  } finally {
    await production.close();
  }
});
test('Validação de campos, proprietário inativo e integridade no banco', async () => {
  assert.equal(
    (await request('POST', '/properties', 'admin', { ...property(ownerId), rent: -1 })).statusCode,
    400,
  );
  assert.equal(
    (await request('POST', '/properties', 'admin', { ...property(ownerId), postal_code: '123' }))
      .statusCode,
    400,
  );
  assert.equal(
    (await request('PATCH', `/users/${owner2Id}`, 'admin', { active: false })).statusCode,
    200,
  );
  assert.equal((await request('POST', '/properties', 'admin', property(owner2Id))).statusCode, 400);
  await assert.rejects(
    db.query('UPDATE properties SET owner_id=$1 WHERE id=$2', [tenantId, propertyId]),
    { code: '23514' },
  );
});
test('Expiração e logout invalidam a sessão no servidor', async () => {
  assert.equal((await request('GET', '/auth/me', 'tenant')).statusCode, 200);
  await db.query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1", [
    tenantId,
  ]);
  assert.equal((await request('GET', '/auth/me', 'tenant')).statusCode, 401);
  assert.equal((await request('POST', '/auth/logout', 'owner', {})).statusCode, 204);
  assert.equal((await request('GET', '/auth/me', 'owner')).statusCode, 401);
});
test('Limite de tentativas de autenticação', async () => {
  let status = 0;
  for (let i = 0; i < 11; i++)
    status = (
      await request('POST', '/auth/login', undefined, {
        email: 'unknown@test.example',
        password: 'wrong',
      })
    ).statusCode;
  assert.equal(status, 429);
});
