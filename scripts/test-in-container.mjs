import { spawnSync } from 'node:child_process';
const url = new URL(process.env.DATABASE_URL);
url.pathname = '/imobitech_test';
const result = spawnSync('npm', ['test'], {
  cwd: '/app',
  env: { ...process.env, TEST_DATABASE_URL: url.toString() },
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
