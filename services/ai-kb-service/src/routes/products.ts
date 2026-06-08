// Product knowledge-base CRUD. Each create/update regenerates the embedding so RAG stays
// current. Protected by the admin token (managers maintain the catalog).
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import pgvector from 'pgvector/pg';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { embedOne } from '../clients/embeddings.js';
import { config } from '../config.js';

const productInput = z.object({
  section: z.string().min(1),
  name: z.string().min(1),
  sku: z.string().optional().nullable(),
  price: z.number().optional().nullable(),
  currency: z.string().default('USD'),
  in_stock: z.boolean().default(true),
  specs: z.record(z.unknown()).default({}),
  description: z.string().optional().nullable(),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  image_urls: z.array(z.string()).default([]),
});
type ProductInput = z.infer<typeof productInput>;

/** Build the text that gets embedded (multilingual aware: name + desc + specs + FAQs). */
function embedText(p: ProductInput): string {
  const specs = Object.entries(p.specs).map(([k, v]) => `${k}: ${v}`).join('; ');
  const faqs = p.faqs.map((f) => `${f.q} ${f.a}`).join(' ');
  return [p.name, p.section, p.description ?? '', specs, faqs].filter(Boolean).join('\n');
}

function requireAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
  if (req.headers['x-admin-token'] !== config.AI_KB_ADMIN_TOKEN) {
    reply.code(401).send({ error: 'unauthorized' });
    return false;
  }
  return true;
}

export async function productRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/products')) requireAdmin(req, reply);
  });

  app.get('/products', async (req) => {
    const { section, q } = req.query as { section?: string; q?: string };
    const params: unknown[] = [];
    const where: string[] = [];
    if (section) {
      params.push(section);
      where.push(`section = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(name ILIKE $${params.length} OR sku ILIKE $${params.length})`);
    }
    const sql = `SELECT id, section, name, sku, price, currency, in_stock, specs, description,
                        faqs, image_urls, created_at, updated_at
                   FROM products ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                   ORDER BY updated_at DESC LIMIT 200`;
    const { rows } = await query(sql, params);
    return { products: rows };
  });

  app.post('/products', async (req, reply) => {
    const parsed = productInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const p = parsed.data;
    const embedding = pgvector.toSql(await embedOne(embedText(p), 'document'));
    const { rows } = await query(
      `INSERT INTO products
         (section, name, sku, price, currency, in_stock, specs, description, faqs, image_urls, embedding)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [p.section, p.name, p.sku ?? null, p.price ?? null, p.currency, p.in_stock,
       p.specs, p.description ?? null, JSON.stringify(p.faqs), p.image_urls, embedding],
    );
    return reply.code(201).send({ id: rows[0]!.id });
  });

  app.put('/products/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const parsed = productInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const p = parsed.data;
    const embedding = pgvector.toSql(await embedOne(embedText(p), 'document'));
    await query(
      `UPDATE products SET section=$1, name=$2, sku=$3, price=$4, currency=$5, in_stock=$6,
              specs=$7, description=$8, faqs=$9, image_urls=$10, embedding=$11, updated_at=now()
        WHERE id=$12`,
      [p.section, p.name, p.sku ?? null, p.price ?? null, p.currency, p.in_stock,
       p.specs, p.description ?? null, JSON.stringify(p.faqs), p.image_urls, embedding, id],
    );
    return { ok: true };
  });

  app.delete('/products/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    await query(`DELETE FROM products WHERE id = $1`, [id]);
    return { ok: true };
  });
}
