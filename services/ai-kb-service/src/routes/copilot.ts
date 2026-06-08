// Endpoints powering the Copilot sidebar (a Chatwoot Dashboard App iframe) that employees
// use inside a conversation: on-demand draft, translate, and live product lookup.
//
// NOTE: these are called from the agent's browser. In production, put them behind the
// Chatwoot session / a short-lived token so only logged-in agents can call them.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { generateDraft } from '../services/draft.js';
import { searchProducts } from '../services/rag.js';
import { translate } from '../clients/claude.js';

export async function copilotRoutes(app: FastifyInstance) {
  // On-demand draft: returns the suggestion to the sidebar WITHOUT posting a note,
  // so the agent can copy/edit it directly into the reply box.
  app.post('/copilot/draft', async (req, reply) => {
    const schema = z.object({
      conversation_id: z.number(),
      section: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const result = await generateDraft(parsed.data.conversation_id, {
      section: parsed.data.section,
      post: false,
    });
    return result;
  });

  app.post('/copilot/translate', async (req, reply) => {
    const schema = z.object({ text: z.string().min(1), target: z.enum(['ar', 'en']) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    return { translation: await translate(parsed.data.text, parsed.data.target) };
  });

  // Live product lookup for the sidebar search box.
  app.get('/copilot/products', async (req) => {
    const { q, section } = req.query as { q?: string; section?: string };
    if (!q) return { products: [] };
    const hits = await searchProducts(q, { section, limit: 8 });
    return { products: hits };
  });
}
