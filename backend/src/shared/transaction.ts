import type { Pool, PoolClient } from 'pg';
export async function transaction<T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<T>,
  actorId?: string,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (actorId) await client.query("SELECT set_config('imobitech.actor_id',$1,true)", [actorId]);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
