import type { FastifyInstance } from 'fastify';
import { pool } from '../db/pool.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/ready', async (_req, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ready' };
    } catch (err) {
      reply.code(503);
      return { status: 'not-ready', error: (err as Error).message };
    }
  });
}
