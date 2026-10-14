import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const checks = [];
const redirected = await fetch('http://localhost', { redirect: 'manual' });
assert.equal(redirected.status, 308);
assert.match(redirected.headers.get('location'), /^https:\/\/localhost/);
checks.push('PASS HTTP redireciona para HTTPS com 308');
const root = await fetch('https://localhost');
assert.equal(root.status, 200);
assert.ok(root.headers.get('strict-transport-security'));
assert.ok(root.headers.get('content-security-policy'));
checks.push('PASS TLS com CA local confiável, HSTS e CSP; validação de certificado habilitada');
const headers = { origin: 'https://localhost', 'content-type': 'application/json' };
const login = await fetch('https://localhost/api/auth/login', {
  method: 'POST',
  headers,
  body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
});
assert.equal(login.status, 200);
const setCookie = login.headers.get('set-cookie');
for (const flag of ['Secure', 'HttpOnly', 'SameSite=Strict']) assert.ok(setCookie.includes(flag));
assert.equal(login.headers.get('cache-control'), 'no-store');
checks.push('PASS login HTTPS e cookie Secure/HttpOnly/SameSite=Strict/Cache-Control no-store');
const cookie = setCookie.split(';')[0];
const logout = await fetch('https://localhost/api/auth/logout', {
  method: 'POST',
  headers: { ...headers, cookie },
  body: '{}',
});
assert.equal(logout.status, 204);
assert.equal((await fetch('https://localhost/api/auth/me', { headers: { cookie } })).status, 401);
checks.push('PASS logout HTTPS revoga sessão');
console.log(checks.join('\n'));
await writeFile(
  'docs/evidence/https.txt',
  `Executado em ${new Date().toISOString()}\n${checks.join('\n')}\n`,
);
