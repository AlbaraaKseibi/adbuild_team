import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from './config.js';
import { healthRoutes } from './routes/health.js';
import { webhookRoutes } from './routes/webhook.js';
import { productRoutes } from './routes/products.js';
import { copilotRoutes } from './routes/copilot.js';
import { adRoutingRoutes } from './routes/adRouting.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// Serve the Copilot sidebar (Dashboard App iframe) from /public.
// Externally reachable at https://$HOST/ai/sidebar.html (Caddy strips the /ai prefix).
const here = dirname(fileURLToPath(import.meta.url));
await app.register(fastifyStatic, { root: join(here, 'public'), prefix: '/' });

await app.register(healthRoutes);
await app.register(webhookRoutes);
await app.register(productRoutes);
await app.register(copilotRoutes);
await app.register(adRoutingRoutes);

try {
  await app.listen({ port: config.AI_KB_PORT, host: '0.0.0.0' });
  app.log.info(`ai-kb-service listening on :${config.AI_KB_PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
