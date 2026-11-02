import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
// Run inside the QA container, with the local CA trusted and synthetic QA data.
const base = 'https://localhost/api';
const headers = { origin: 'https://localhost', 'content-type': 'application/json' };
const login = await fetch(`${base}/auth/login`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get('set-cookie').split(';')[0];
const paths = ['/properties', '/contracts', '/visits', '/users', '/health'];
const results = await Promise.all(
  Array.from({ length: 50 }, async (_, i) => {
    const path = paths[i % paths.length];
    const start = performance.now();
    const response = await fetch(`${base}${path}`, { headers: { cookie } });
    await response.text();
    return { path, status: response.status, ms: Math.round(performance.now() - start) };
  }),
);
const sorted = results.map((r) => r.ms).sort((a, b) => a - b);
const writes = [];
const measured = async (path, method, data) => {
  const start = performance.now();
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...headers, cookie },
    body: JSON.stringify(data),
  });
  const body = await response.json();
  writes.push({
    path: path.replace(/[a-f0-9]{8}-[a-f0-9-]{27,}/g, ':id'),
    method,
    status: response.status,
    ms: Math.round(performance.now() - start),
  });
  assert.ok(response.ok, JSON.stringify(body));
  return body;
};
const suffix = crypto.randomUUID();
const owner = await measured('/users', 'POST', {
  name: 'Owner Performance',
  email: `owner-${suffix}@performance.test`,
  role: 'owner',
  password: crypto.randomUUID(),
});
const tenant = await measured('/users', 'POST', {
  name: 'Tenant Performance',
  email: `tenant-${suffix}@performance.test`,
  role: 'tenant',
  password: crypto.randomUUID(),
});
const property = await measured('/properties', 'POST', {
  title: 'Imóvel Performance',
  type: 'apartment',
  street: 'Rua Teste',
  number: '1',
  neighborhood: 'Centro',
  city: 'Brasília',
  state: 'DF',
  postal_code: '70000000',
  rent: 1000,
  owner_id: owner.id,
});
const year = new Date().getFullYear();
const contract = await measured('/contracts', 'POST', {
  property_id: property.id,
  owner_id: owner.id,
  tenant_id: tenant.id,
  start_date: `${year - 1}-01-01`,
  end_date: `${year + 1}-12-31`,
  monthly_rent: 1000,
  due_day: 10,
});
const payment = await measured(`/contracts/${contract.id}/payments`, 'POST', {
  competence: `${year - 1}-01`,
  amount: 1000,
  due_date: `${year - 1}-01-10`,
});
await measured(`/payments/${payment.id}`, 'PATCH', { paid_at: `${year - 1}-01-10` });
await measured(`/contracts/${contract.id}`, 'PATCH', { status: 'closed' });
const report = {
  at: new Date().toISOString(),
  concurrency: 50,
  scope:
    '50 consultas simultâneas via HTTPS em Docker local, uma sessão administrativa; não representa 50 usuários independentes nem teste de capacidade prolongado.',
  p95Ms: sorted[47],
  maxMs: sorted[49],
  results,
  writes,
};
await mkdir('docs/evidence/mvp', { recursive: true });
await writeFile('docs/evidence/mvp/performance.json', JSON.stringify(report, null, 2));
assert.ok(
  results.every((r) => r.status === 200),
  'Todas as consultas devem responder 200',
);
assert.ok(report.p95Ms <= 3000, 'p95 deve ser <= 3 segundos');
assert.ok(
  writes.every((r) => r.ms <= 3000),
  'Gravações de homologação devem responder em até 3 segundos',
);
console.log(`PASS 50 consultas simultâneas: p95=${report.p95Ms}ms; máximo=${report.maxMs}ms`);
await fetch(`${base}/auth/logout`, { method: 'POST', headers: { ...headers, cookie }, body: '{}' });
