// Retrieval over the product knowledge base using pgvector cosine similarity.
import pgvector from 'pgvector/pg';
import { query } from '../db/pool.js';
import { embedOne } from '../clients/embeddings.js';

export interface ProductHit {
  id: number;
  section: string;
  name: string;
  sku: string | null;
  price: string | null;
  currency: string | null;
  in_stock: boolean;
  specs: Record<string, unknown>;
  description: string | null;
  faqs: { q: string; a: string }[];
  distance: number;
}

/**
 * Find products most relevant to `text`. Optionally restrict to a section so an
 * employee's section context is respected.
 */
export async function searchProducts(
  text: string,
  opts: { section?: string; limit?: number } = {},
): Promise<ProductHit[]> {
  const limit = opts.limit ?? 5;
  const vec = pgvector.toSql(await embedOne(text, 'query'));

  const params: unknown[] = [vec];
  let where = 'embedding IS NOT NULL';
  if (opts.section) {
    params.push(opts.section);
    where += ` AND section = $${params.length}`;
  }
  params.push(limit);

  const { rows } = await query<ProductHit>(
    `SELECT id, section, name, sku, price, currency, in_stock, specs, description, faqs,
            embedding <=> $1 AS distance
       FROM products
      WHERE ${where}
      ORDER BY embedding <=> $1
      LIMIT $${params.length}`,
    params,
  );
  return rows;
}

/** Render hits into a compact, model-friendly context block. */
export function renderProductContext(hits: ProductHit[]): string {
  if (hits.length === 0) return '';
  return hits
    .map((h) => {
      const price = h.price ? `${h.price} ${h.currency ?? ''}`.trim() : 'price on request';
      const stock = h.in_stock ? 'in stock' : 'out of stock';
      const specs = Object.entries(h.specs ?? {})
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ');
      const faqs = (h.faqs ?? []).map((f) => `Q: ${f.q} A: ${f.a}`).join(' | ');
      return [
        `- ${h.name}${h.sku ? ` (SKU ${h.sku})` : ''} [${h.section}] — ${price}, ${stock}`,
        specs && `  specs: ${specs}`,
        h.description && `  ${h.description}`,
        faqs && `  FAQ: ${faqs}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');
}
