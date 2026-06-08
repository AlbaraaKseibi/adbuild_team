import pg from 'pg';
import pgvector from 'pgvector/pg';
import { config } from '../config.js';

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL });

// Register the pgvector type parser on each new connection so `vector` columns
// round-trip as JS number[] arrays.
pool.on('connect', async (client) => {
  await pgvector.registerType(client);
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}
