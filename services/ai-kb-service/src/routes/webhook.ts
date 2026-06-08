// Chatwoot webhook / agent-bot endpoint.
//  - conversation_created: read ad referral (set by the Chatwoot fork patch B2),
//    resolve the section, and auto-assign the team. No match -> stays in Triage.
//  - message_created (incoming): generate a Claude draft and post it as a private note.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { resolveTeam } from '../services/adRouting.js';
import { generateDraft } from '../services/draft.js';
import { assignTeam } from '../clients/chatwoot.js';

interface ChatwootEvent {
  event?: string;
  id?: number; // conversation id on conversation_* events
  message_type?: string | number;
  private?: boolean;
  content?: string;
  conversation?: { id?: number; meta?: { assignee?: unknown } };
  additional_attributes?: Record<string, unknown>;
  // team / section may be present on the conversation
  meta?: { team?: { name?: string } };
}

function authorized(req: FastifyRequest): boolean {
  if (!config.CHATWOOT_WEBHOOK_SECRET) return true; // not enforced if unset
  const token = (req.query as Record<string, string>)?.token ?? req.headers['x-webhook-token'];
  return token === config.CHATWOOT_WEBHOOK_SECRET;
}

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/webhooks/chatwoot', async (req, reply) => {
    if (!authorized(req)) {
      reply.code(401);
      return { error: 'unauthorized' };
    }

    const body = req.body as ChatwootEvent;
    const event = body.event;

    try {
      if (event === 'conversation_created') {
        const conversationId = body.id;
        const attrs = body.additional_attributes ?? {};
        if (conversationId && attrs.is_from_ad) {
          const rule = await resolveTeam({
            adId: (attrs.ad_id as string) ?? null,
            headline: (attrs.ad_headline as string) ?? null,
            sourceUrl: (attrs.ad_source_url as string) ?? null,
          });
          if (rule) {
            await assignTeam(conversationId, rule.team_id);
            req.log.info({ conversationId, teamId: rule.team_id }, 'ad-routed to section');
          }
        }
        return { ok: true };
      }

      if (event === 'message_created') {
        const isIncoming = body.message_type === 'incoming' || body.message_type === 0;
        const conversationId = body.conversation?.id;
        if (isIncoming && !body.private && conversationId) {
          const section = body.meta?.team?.name; // may be undefined → unscoped search
          // Fire-and-forget so the webhook returns fast; errors are logged.
          generateDraft(conversationId, { section, post: true }).catch((err) =>
            req.log.error({ err, conversationId }, 'draft generation failed'),
          );
        }
        return { ok: true };
      }

      return { ok: true, ignored: event };
    } catch (err) {
      req.log.error({ err, event }, 'webhook handling failed');
      reply.code(500);
      return { error: 'internal' };
    }
  });
}
