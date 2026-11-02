import pg from 'pg';
// PostgreSQL DATE is a calendar day, not a timestamp in the host's timezone.
pg.types.setTypeParser(1082, (value: string) => value);
export function createPool(connectionString: string) {
  return new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000 });
}
