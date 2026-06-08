// Admin endpoints to manage the ad -> section (team) mapping that drives auto-assignment.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { listRules, createRule, deleteRule } from '../services/adRouting.js';

function requireAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
  if (req.headers['x-admin-token'] !== config.AI_KB_ADMIN_TOKEN) {
    reply.code(401).send({ error: 'unauthorized' });
    return false;
  }
  return true;
}

export async function adRoutingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/admin/ad-routing')) requireAdmin(req, reply);
  });

  app.get('/admin/ad-routing', async () => ({ rules: await listRules() }));

  app.post('/admin/ad-routing', async (req, reply) => {
    const schema = z.object({
      match_type: z.enum(['ad_id', 'campaign_regex']),
      match_value: z.string().min(1),
      team_id: z.number().int(),
      section: z.string().optional().nullable(),
      priority: z.number().int().default(100),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const rule = await createRule({
      match_type: parsed.data.match_type,
      match_value: parsed.data.match_value,
      team_id: parsed.data.team_id,
      section: parsed.data.section ?? null,
      priority: parsed.data.priority,
    });
    return reply.code(201).send(rule);
  });

  app.delete('/admin/ad-routing/:id', async (req) => {
    await deleteRule(Number((req.params as { id: string }).id));
    return { ok: true };
  });
}
