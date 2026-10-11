import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
import { createPool } from './pool.js';
import { getConfig } from '../shared/config.js';
export async function migrate(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(100601)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const dir = fileURLToPath(new URL('../../../database/migrations/', import.meta.url));
    for (const name of (await readdir(dir)).filter((n) => n.endsWith('.sql')).sort()) {
      if ((await client.query('SELECT 1 FROM migrations WHERE name=$1', [name])).rowCount) continue;
      await client.query(await readFile(`${dir}/${name}`, 'utf8'));
      await client.query('INSERT INTO migrations(name) VALUES($1)', [name]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const pool = createPool(getConfig().DATABASE_URL);
  try {
    await migrate(pool);
    console.log('Migrations aplicadas.');
  } finally {
    await pool.end();
  }
}
