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
test('US04–US07: fluxo completo, concorrência, isolamento e histórico financeiro', async () => {
  for (const role of ['admin', 'broker', 'owner', 'owner2', 'tenant']) {
    const response = await request('POST', '/auth/login', undefined, {
      email: `${role}@test.example`,
      password,
    });
    assert.equal(response.statusCode, 200, response.body);
    cookies[role] = String(response.headers['set-cookie']).split(';')[0];
  }
  const created = await request('POST', '/properties', 'admin', property(ownerId));
  assert.equal(created.statusCode, 201, created.body);
  propertyId = created.json().id;
  const starts_at = new Date(Date.now() + 86400000).toISOString();
  const ends_at = new Date(Date.now() + 90000000).toISOString();
  const visit = {
    property_id: propertyId,
    participant_name: 'Pessoa interessada',
    starts_at,
    ends_at,
  };
  const overlap = await Promise.all([
    request('POST', '/visits', 'broker', visit),
    request('POST', '/visits', 'broker', visit),
  ]);
  assert.deepEqual(overlap.map((r) => r.statusCode).sort(), [201, 409]);
  const visitId = overlap.find((r) => r.statusCode === 201)!.json().id;
  assert.equal(
    (await request('PATCH', `/visits/${visitId}`, 'broker', { status: 'confirmed' })).statusCode,
    200,
  );
  assert.equal(
    (await request('PATCH', `/visits/${visitId}`, 'broker', { status: 'cancelled' })).statusCode,
    200,
  );
  assert.equal((await request('POST', '/visits', 'broker', visit)).statusCode, 201);
  assert.equal((await request('GET', '/visits', 'tenant')).statusCode, 403);
  assert.equal(
    (
      await request('POST', '/visits', 'broker', {
        ...visit,
        starts_at: '2000-01-01T10:00:00Z',
        ends_at: '2000-01-01T11:00:00Z',
      })
    ).statusCode,
    400,
  );
  const year = new Date().getFullYear();
  const contract = {
    property_id: propertyId,
    owner_id: ownerId,
    tenant_id: tenantId,
    start_date: `${year - 1}-01-01`,
    end_date: `${year + 1}-12-31`,
    monthly_rent: 1800,
    due_day: 10,
  };
  assert.equal((await request('POST', '/contracts', 'broker', contract)).statusCode, 403);
  const concurrent = await Promise.all([
    request('POST', '/contracts', 'admin', contract),
    request('POST', '/contracts', 'admin', contract),
  ]);
  assert.deepEqual(concurrent.map((r) => r.statusCode).sort(), [201, 409]);
  const id = concurrent.find((r) => r.statusCode === 201)!.json().id;
  assert.equal(
    (await db.query('SELECT status FROM properties WHERE id=$1', [propertyId])).rows[0].status,
    'unavailable',
  );
  assert.equal((await request('GET', `/contracts/${id}`, 'owner2')).statusCode, 404);
  assert.equal((await request('GET', '/contracts', 'owner2')).json().total, 0);
  assert.equal((await request('GET', `/contracts/${id}`, 'tenant')).statusCode, 200);
  assert.equal(
    (await request('PATCH', `/contracts/${id}`, 'tenant', { monthly_rent: 1 })).statusCode,
    403,
  );
  assert.equal(
    (await request('PATCH', `/contracts/${id}`, 'admin', { monthly_rent: 1900 })).statusCode,
    200,
  );
  const payment = {
    competence: `${year - 1}-01`,
    amount: 1900,
    due_date: `${year - 1}-01-10`,
    paid_at: null,
  };
  const pay = await request('POST', `/contracts/${id}/payments`, 'admin', payment);
  assert.equal(pay.statusCode, 201, pay.body);
  const paymentId = pay.json().id;
  assert.equal(pay.json().status, 'overdue');
  assert.equal(
    (await request('POST', `/contracts/${id}/payments`, 'admin', payment)).statusCode,
    409,
  );
  assert.equal(
    (
      await request('POST', `/contracts/${id}/payments`, 'admin', {
        ...payment,
        competence: `${year}-02`,
        amount: -1,
      })
    ).statusCode,
    400,
  );
  assert.equal((await request('GET', `/payments/${paymentId}`, 'owner2')).statusCode, 404);
  assert.equal((await request('GET', `/contracts/${id}/payments`, 'broker')).statusCode, 403);
  const paid = await request('PATCH', `/payments/${paymentId}`, 'admin', {
    paid_at: `${year - 1}-01-10`,
  });
  assert.equal(paid.statusCode, 200, paid.body);
  assert.equal(paid.json().status, 'paid');
  assert.equal((await request('GET', `/contracts/${id}/payments`, 'owner')).json().items.length, 1);
  assert.equal(
    (await request('PATCH', `/contracts/${id}`, 'admin', { status: 'closed' })).statusCode,
    200,
  );
  assert.equal(
    (await db.query('SELECT status FROM properties WHERE id=$1', [propertyId])).rows[0].status,
    'available',
  );
  assert.equal(
    (await request('PATCH', `/contracts/${id}`, 'admin', { monthly_rent: 1 })).statusCode,
    409,
  );
  const events = (await request('GET', `/contracts/${id}/history`, 'admin')).json();
  assert.equal(events.length, 5);
  assert.ok(events.every((event: any) => event.actor_name === 'Admin Teste' && event.occurred_at));
  await assert.rejects(
    db.query('DELETE FROM audit_events'),
    /history|hist|audit|immutable|preserv/i,
  );
});

test('RN007–RN014: conflitos independentes, vínculos inválidos e rollback', async () => {
  const service = new UserService(db);
  const second = await service.create({
    name: 'Segundo Corretor',
    email: 'broker2@test.example',
    role: 'broker',
    password,
  });
  const login = await request('POST', '/auth/login', undefined, { email: second.email, password });
  cookies.broker2 = String(login.headers['set-cookie']).split(';')[0];
  const p1 = (await request('POST', '/properties', 'admin', property(ownerId))).json().id;
  const p2 = (await request('POST', '/properties', 'admin', property(ownerId))).json().id;
  const start = new Date(Date.now() + 86400000 * 5),
    end = new Date(start.getTime() + 3600000);
  const visit = {
    property_id: p1,
    participant_name: 'Teste conflito',
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
  };
  const r = await request('POST', '/visits', 'broker', visit);
  assert.equal(r.statusCode, 201, r.body);
  assert.equal(
    (await request('POST', '/visits', 'broker2', visit)).statusCode,
    409,
    'mesmo imóvel, outro corretor',
  );
  assert.equal(
    (await request('POST', '/visits', 'broker', { ...visit, property_id: p2 })).statusCode,
    409,
    'outro imóvel, mesmo corretor',
  );
  assert.equal(
    (await request('PATCH', `/visits/${r.json().id}`, 'broker2', { status: 'cancelled' }))
      .statusCode,
    404,
  );
  assert.equal(
    (
      await request('POST', '/visits', 'broker', {
        ...visit,
        starts_at: end.toISOString(),
        ends_at: new Date(end.getTime() + 3600000).toISOString(),
      })
    ).statusCode,
    201,
    'intervalo adjacente',
  );
  const year = new Date().getFullYear();
  const body = {
    property_id: p1,
    owner_id: ownerId,
    tenant_id: tenantId,
    start_date: `${year}-01-01`,
    end_date: `${year + 1}-12-31`,
    monthly_rent: 1000,
    due_day: 31,
  };
  assert.equal(
    (await request('POST', '/contracts', 'admin', { ...body, owner_id: owner2Id })).statusCode,
    400,
  );
  assert.equal(
    (await db.query('SELECT status FROM properties WHERE id=$1', [p1])).rows[0].status,
    'available',
  );
  const created = await request('POST', '/contracts', 'admin', body);
  assert.equal(created.statusCode, 201, created.body);
  const id = created.json().id;
  assert.equal(
    (await request('PATCH', `/properties/${p1}`, 'admin', { status: 'available' })).statusCode,
    409,
  );
  assert.equal(
    (await request('PATCH', `/users/${tenantId}`, 'admin', { role: 'broker' })).statusCode,
    409,
  );
  const payment = {
    competence: `${year + 1}-01`,
    amount: 1000,
    due_date: `${year + 1}-01-31`,
    paid_at: null,
  };
  const pay = await request('POST', `/contracts/${id}/payments`, 'admin', payment);
  assert.equal(pay.statusCode, 201, pay.body);
  assert.equal(pay.json().status, 'pending');
  assert.equal(
    (
      await request('PATCH', `/payments/${pay.json().id}`, 'admin', {
        paid_at: `${year + 2}-01-01`,
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (await request('PATCH', `/contracts/${id}`, 'admin', { end_date: `${year}-12-31` })).statusCode,
    409,
  );
  const list = (await request('GET', `/contracts/${id}/payments`, 'tenant')).json();
  assert.equal(Number(list.summary.pending), 1000);
  assert.equal(Number(list.summary.overdue), 0);
  const history = (await request('GET', `/contracts/${id}/history`, 'admin')).json();
  assert.equal(history.length, 2, 'falhas não criam eventos nem alteração parcial');
  for (const route of [
    '/contracts',
    '/visits',
    `/contracts/${id}/payments`,
    `/payments/${pay.json().id}`,
  ])
    assert.equal((await request('GET', route)).statusCode, 401);
});

test('Critérios restantes: imóvel inelegível, entradas inválidas e isolamento bilateral do financeiro', async () => {
  const tenant2 = await new UserService(db).create({
    name: 'Segundo Inquilino',
    email: 'tenant2@test.example',
    role: 'tenant',
    password,
  });
  const login = await request('POST', '/auth/login', undefined, {
    email: tenant2.email,
    password,
  });
  assert.equal(login.statusCode, 200, login.body);
  cookies.tenant2 = String(login.headers['set-cookie']).split(';')[0];
  const p = await request('POST', '/properties', 'admin', property(owner2Id));
  assert.equal(p.statusCode, 201, p.body);
  const property2 = p.json().id;
  const start = new Date(Date.now() + 3 * 86400000).toISOString();
  const end = new Date(Date.now() + 3 * 86400000 + 3600000).toISOString();
  const validVisit = {
    property_id: property2,
    participant_name: 'Pessoa interessada',
    starts_at: start,
    ends_at: end,
  };
  assert.equal(
    (await request('POST', '/visits', 'broker', { ...validVisit, participant_name: '' }))
      .statusCode,
    400,
  );
  assert.equal(
    (await request('PATCH', `/properties/${property2}`, 'admin', { status: 'unavailable' }))
      .statusCode,
    200,
  );
  assert.equal((await request('POST', '/visits', 'broker', validVisit)).statusCode, 409);
  assert.equal(
    (await request('PATCH', `/properties/${property2}`, 'admin', { status: 'available' }))
      .statusCode,
    200,
  );
  const year = new Date().getFullYear();
  const contract = {
    property_id: property2,
    owner_id: owner2Id,
    tenant_id: tenant2.id,
    start_date: `${year}-01-01`,
    end_date: `${year + 1}-12-31`,
    monthly_rent: 1500,
    due_day: 10,
  };
  assert.equal(
    (await request('POST', '/contracts', 'admin', { ...contract, due_day: 32 })).statusCode,
    400,
  );
  assert.equal(
    (await request('POST', '/contracts', 'admin', { ...contract, end_date: `${year - 1}-12-31` }))
      .statusCode,
    400,
  );
  const created = await request('POST', '/contracts', 'admin', contract);
  assert.equal(created.statusCode, 201, created.body);
  const id = created.json().id;
  assert.equal((await request('GET', `/contracts/${id}`, 'owner')).statusCode, 404);
  assert.equal((await request('GET', `/contracts/${id}`, 'tenant')).statusCode, 404);
  assert.equal((await request('GET', `/contracts/${id}`, 'owner2')).statusCode, 200);
  assert.equal((await request('GET', `/contracts/${id}`, 'tenant2')).statusCode, 200);
  assert.equal((await request('GET', `/contracts/${id}/payments`, 'owner2')).json().total, 0);
  assert.equal((await request('GET', `/contracts/${id}/payments`, 'tenant2')).json().total, 0);
  const payment = {
    competence: `${year}-01`,
    amount: 1500,
    due_date: `${year}-01-10`,
  };
  assert.equal(
    (await request('POST', `/contracts/${id}/payments`, 'broker', payment)).statusCode,
    403,
  );
  assert.equal(
    (await request('POST', `/contracts/${id}/payments`, 'admin', { ...payment, amount: -1 }))
      .statusCode,
    400,
  );
  const posted = await request('POST', `/contracts/${id}/payments`, 'admin', payment);
  assert.equal(posted.statusCode, 201, posted.body);
  assert.equal((await request('GET', `/payments/${posted.json().id}`, 'owner')).statusCode, 404);
  assert.equal((await request('GET', `/payments/${posted.json().id}`, 'tenant')).statusCode, 404);
  assert.equal((await request('GET', `/payments/${posted.json().id}`, 'owner2')).statusCode, 200);
  assert.equal((await request('GET', `/payments/${posted.json().id}`, 'tenant2')).statusCode, 200);
  assert.equal(
    (await request('PATCH', `/payments/${posted.json().id}`, 'tenant2', { amount: 1 })).statusCode,
    403,
  );
  assert.equal((await request('GET', `/contracts/${id}/history`, 'owner2')).statusCode, 403);
});

test('Busca de contrato: cadastros elegíveis aparecem sem termo e por e-mail ou endereço', async () => {
  const created = await request('POST', '/properties', 'admin', {
    ...property(ownerId),
    title: 'Casa disponível para busca',
  });
  assert.equal(created.statusCode, 201, created.body);
  const propertyId = created.json().id;
  const tenants = await request('GET', '/contracts/options?kind=tenants&search=', 'admin');
  assert.equal(tenants.statusCode, 200);
  assert.ok(tenants.json().some((item: { id: string }) => item.id === tenantId));
  const byEmail = await request(
    'GET',
    '/contracts/options?kind=tenants&search=tenant%40test.example',
    'admin',
  );
  assert.equal(byEmail.statusCode, 200);
  assert.ok(byEmail.json().some((item: { id: string }) => item.id === tenantId));
  const properties = await request('GET', '/contracts/options?kind=properties&search=', 'admin');
  assert.equal(properties.statusCode, 200);
  assert.ok(properties.json().some((item: { id: string }) => item.id === propertyId));
  assert.equal(properties.json().find((item: { id: string }) => item.id === propertyId).rent, '1800.50');
  const byStreet = await request(
    'GET',
    '/contracts/options?kind=properties&search=Rua%20de%20teste',
    'admin',
  );
  assert.equal(byStreet.statusCode, 200);
  assert.ok(byStreet.json().some((item: { id: string }) => item.id === propertyId));
  assert.equal((await request('GET', '/contracts/options?kind=tenants', 'broker')).statusCode, 403);
  assert.equal(
    (await request('PATCH', `/properties/${propertyId}`, 'admin', { status: 'unavailable' }))
      .statusCode,
    200,
  );
  const unavailable = await request(
    'GET',
    '/contracts/options?kind=properties&search=Casa',
    'admin',
  );
  assert.ok(!unavailable.json().some((item: { id: string }) => item.id === propertyId));
});
