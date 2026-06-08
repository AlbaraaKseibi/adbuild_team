// Multilingual embeddings (Arabic + English) with a pluggable provider.
// Default: Voyage AI (Anthropic-recommended). Set EMBEDDINGS_PROVIDER=openai to switch.
import { config } from '../config.js';

export type EmbeddingInputType = 'document' | 'query';

async function embedVoyage(texts: string[], inputType: EmbeddingInputType): Promise<number[][]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: texts,
      model: config.VOYAGE_MODEL,
      input_type: inputType, // 'document' for catalog, 'query' for searches
      output_dimension: config.VOYAGE_DIMENSIONS,
    }),
  });
  if (!res.ok) throw new Error(`Voyage embeddings failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

async function embedOpenAI(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: texts, model: config.OPENAI_EMBEDDINGS_MODEL }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

export async function embed(
  texts: string[],
  inputType: EmbeddingInputType = 'document',
): Promise<number[][]> {
  if (texts.length === 0) return [];
  return config.EMBEDDINGS_PROVIDER === 'openai'
    ? embedOpenAI(texts)
    : embedVoyage(texts, inputType);
}

export async function embedOne(
  text: string,
  inputType: EmbeddingInputType = 'query',
): Promise<number[]> {
  const [v] = await embed([text], inputType);
  if (!v) throw new Error('embedding returned empty result');
  return v;
}
