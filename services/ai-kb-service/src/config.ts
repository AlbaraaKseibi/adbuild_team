// Centralised, validated configuration. Fails fast at boot if required env is missing.
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  AI_KB_PORT: z.coerce.number().default(4000),
  // Railway (and most PaaS) inject PORT at runtime; honour it if present.
  PORT: z.coerce.number().optional(),

  DATABASE_URL: z.string().url(),

  // Chatwoot API (read conversations, post draft private notes, assign teams).
  CHATWOOT_BASE_URL: z.string().url(),
  CHATWOOT_API_ACCESS_TOKEN: z.string().min(1),
  CHATWOOT_ACCOUNT_ID: z.coerce.number(),
  CHATWOOT_WEBHOOK_SECRET: z.string().default(''),

  // Anthropic (Claude) — drafts replies.
  ANTHROPIC_API_KEY: z.string().min(1),
  CLAUDE_DRAFT_MODEL: z.string().default('claude-sonnet-4-6'),

  // Embeddings for the product knowledge base (multilingual: AR + EN).
  EMBEDDINGS_PROVIDER: z.enum(['voyage', 'openai']).default('voyage'),
  VOYAGE_API_KEY: z.string().default(''),
  VOYAGE_MODEL: z.string().default('voyage-3'),
  VOYAGE_DIMENSIONS: z.coerce.number().default(1024),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_EMBEDDINGS_MODEL: z.string().default('text-embedding-3-large'),

  // Protects product-catalog + ad-routing admin endpoints.
  AI_KB_ADMIN_TOKEN: z.string().min(1),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

// Resolved HTTP port: prefer the PaaS-injected PORT, fall back to AI_KB_PORT.
export const httpPort: number = parsed.data.PORT ?? parsed.data.AI_KB_PORT;

// Embedding vector dimension used for the pgvector column. OpenAI text-embedding-3-large
// is 3072; voyage-3 defaults to 1024. Keep the DB column in sync with the active provider.
export const EMBEDDING_DIM =
  config.EMBEDDINGS_PROVIDER === 'openai' ? 3072 : config.VOYAGE_DIMENSIONS;
