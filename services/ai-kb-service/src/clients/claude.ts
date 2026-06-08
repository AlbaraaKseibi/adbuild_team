// Claude client. Drafts reply suggestions grounded in retrieved product context and the
// customer's conversation history. Uses prompt caching on the (stable) system prompt to
// cut cost/latency across the many drafts generated per day.
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

export interface DraftTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface DraftRequest {
  /** Conversation history mapped to roles: customer = user, our agents = assistant. */
  history: DraftTurn[];
  /** Retrieved product knowledge-base snippets to ground the answer. */
  productContext: string;
  /** Short summary of the customer (prior deals, preferred section, etc.). */
  customerContext: string;
  /** Section/team name, used to set tone and scope. */
  section: string;
}

const SYSTEM_PROMPT = `You are an expert sales assistant for a building-materials showroom.
You draft reply suggestions for a human employee, who will review and send them.

Rules:
- Reply in the SAME language the customer is using (Arabic or English). For Arabic, use
  clear Modern Standard / Levantine-friendly phrasing appropriate for retail customers.
- Be warm, concise, and helpful. Aim to move the customer toward a visit or a purchase.
- Ground every factual claim (price, specs, stock) ONLY in the provided product context.
  If the context lacks the answer, do not invent it — suggest the employee confirm, or ask
  the customer a clarifying question.
- Never reveal that you are an AI or mention internal systems.
- Output ONLY the suggested message text — no preamble, labels, or quotes.`;

export async function draftReply(req: DraftRequest): Promise<string> {
  const contextBlock = [
    `# Section\n${req.section}`,
    `# Customer\n${req.customerContext || 'No prior record.'}`,
    `# Relevant products (knowledge base)\n${req.productContext || 'No matching products found.'}`,
  ].join('\n\n');

  const messages: Anthropic.MessageParam[] = [
    // Cache the grounding context too (changes less often than the latest turn).
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: contextBlock,
          cache_control: { type: 'ephemeral' },
        },
      ],
    },
    ...req.history.map<Anthropic.MessageParam>((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: 'Draft the best next reply to the customer.' },
  ];

  const resp = await anthropic.messages.create({
    model: config.CLAUDE_DRAFT_MODEL,
    max_tokens: 600,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages,
  });

  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

export async function translate(text: string, target: 'ar' | 'en'): Promise<string> {
  const resp = await anthropic.messages.create({
    model: config.CLAUDE_DRAFT_MODEL,
    max_tokens: 600,
    system: [{ type: 'text', text: 'Translate the user message. Output only the translation.' }],
    messages: [{ role: 'user', content: `Translate to ${target}:\n\n${text}` }],
  });
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}
