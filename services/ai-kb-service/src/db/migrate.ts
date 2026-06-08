// Idempotent schema setup. Safe to run on every boot.
import { pool } from './pool.js';
import { EMBEDDING_DIM } from '../config.js';

const ddl = `
CREATE EXTENSION IF NOT EXISTS vector;

-- Product knowledge base. One row per product; embedding powers RAG retrieval.
CREATE TABLE IF NOT EXISTS products (
  id            BIGSERIAL PRIMARY KEY,
  section       TEXT NOT NULL,                 -- e.g. tools | ceramic | tile
  name          TEXT NOT NULL,
  sku           TEXT,
  price         NUMERIC(12,2),
  currency      TEXT DEFAULT 'USD',
  in_stock      BOOLEAN DEFAULT TRUE,
  specs         JSONB DEFAULT '{}'::jsonb,     -- arbitrary structured attributes
  description   TEXT,                          -- free text used for embedding (AR/EN)
  faqs          JSONB DEFAULT '[]'::jsonb,     -- [{q, a}]
  image_urls    TEXT[] DEFAULT '{}',
  embedding     vector(${EMBEDDING_DIM}),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_section_idx ON products (section);
-- Approximate nearest-neighbour index for cosine distance.
CREATE INDEX IF NOT EXISTS products_embedding_idx
  ON products USING hnsw (embedding vector_cosine_ops);

-- Maps Meta ads to sections (Chatwoot team_id) for auto-assignment.
-- match_type 'ad_id'           -> match_value is an exact Meta ad id (referral.source_id)
-- match_type 'campaign_regex'  -> match_value is a regex tested against ad headline / source_url
CREATE TABLE IF NOT EXISTS ad_routing (
  id          BIGSERIAL PRIMARY KEY,
  match_type  TEXT NOT NULL CHECK (match_type IN ('ad_id', 'campaign_regex')),
  match_value TEXT NOT NULL,
  team_id     INTEGER NOT NULL,               -- Chatwoot team id (the section)
  section     TEXT,                            -- human label, for admin clarity
  priority    INTEGER DEFAULT 100,            -- lower wins when multiple rules match
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ad_routing_adid_idx ON ad_routing (match_value)
  WHERE match_type = 'ad_id';
`;

async function main() {
  await pool.query(ddl);
  // eslint-disable-next-line no-console
  console.log(`[migrate] schema ready (embedding dim = ${EMBEDDING_DIM})`);
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[migrate] failed', err);
  process.exit(1);
});
