import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const target = process.argv[2] ?? '.env.docker';
if (!['.env.docker', '.env.qa'].includes(target)) throw new Error('Use .env.docker ou .env.qa.');
const password = randomBytes(24).toString('hex');
const adminPassword = randomBytes(18).toString('base64url');
const contents = [
  'POSTGRES_DB=imobitech',
  'POSTGRES_USER=imobitech',
  `POSTGRES_PASSWORD=${password}`,
  `DATABASE_URL=postgresql://imobitech:${password}@db:5432/imobitech`,
  'APP_DOMAIN=localhost',
  'APP_ORIGIN=https://localhost',
  'SESSION_HOURS=8',
  'ADMIN_NAME=Administrador',
  'ADMIN_EMAIL=admin@imobitech.local',
  `ADMIN_PASSWORD=${adminPassword}`,
  '',
].join('\n');
try {
  await writeFile(target, contents, { flag: 'wx', mode: 0o600 });
  console.log(`${target} criado. Leia ADMIN_EMAIL e ADMIN_PASSWORD nesse arquivo para entrar.`);
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log(`${target} já existe e foi preservado.`);
}
