import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });
const base = 'http://localhost:5173';
const lines = [];
function passed(message) {
  lines.push(`PASS ${message}`);
  console.log(lines.at(-1));
}
const home = await fetch(base);
assert.equal(home.status, 200);
assert.match(await home.text(), /ImobiTech/);
passed('Frontend HTTP 200 com documento ImobiTech');
const health = await fetch(`${base}/api/health`);
assert.equal(health.status, 200);
assert.equal((await health.json()).status, 'ok');
passed('Proxy Vite -> Fastify -> PostgreSQL real');
const denied = await fetch(`${base}/api/users`);
assert.equal(denied.status, 401);
passed('API via proxy: sem sessão retorna 401');
const login = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { origin: process.env.APP_ORIGIN, 'content-type': 'application/json' },
  body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
});
assert.equal(login.status, 200);
assert.equal((await login.json()).role, 'admin');
const cookie = login.headers.get('set-cookie').split(';')[0];
passed('Administrador inicial autentica via HTTP real');
const users = await fetch(`${base}/api/users`, { headers: { cookie } });
assert.equal(users.status, 200);
assert.ok((await users.json()).total >= 1);
passed('Listagem autenticada via cookie de sessão');
const logout = await fetch(`${base}/api/auth/logout`, {
  method: 'POST',
  headers: { cookie, origin: process.env.APP_ORIGIN, 'content-type': 'application/json' },
  body: '{}',
});
assert.equal(logout.status, 204);
assert.equal((await fetch(`${base}/api/auth/me`, { headers: { cookie } })).status, 401);
passed('Logout revoga a sessão no servidor');
await writeFile(
  'docs/evidence/smoke.txt',
  `Execução: ${new Date().toISOString()}\n${lines.join('\n')}\nNão verifica renderização visual nem transporte TLS.\n`,
);
