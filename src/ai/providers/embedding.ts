// 向量化：mock 使用确定性哈希伪向量（128 维），真实模式调用 OpenAI 兼容 embedding 端点
// mock 与 pg 走同一条检索函数，只有向量来源不同

import { hash32 } from '@/lib/utils';

export const EMBEDDING_DIM = 128;

function normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/** 无外网时的确定性向量：字符 unigram + bigram 哈希到 128 维 */
export function hashedEmbedding(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIM).fill(0);
  const cleaned = text.toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9]/g, '');
  const add = (token: string, weight: number) => {
    const h = hash32(token);
    const idx = h % EMBEDDING_DIM;
    const sign = h & 1 ? 1 : -1;
    vec[idx] += sign * weight;
  };
  for (let i = 0; i < cleaned.length; i += 1) {
    add(cleaned[i], 1);
    if (i < cleaned.length - 1) add(cleaned.slice(i, i + 2), 1.6);
  }
  return normalize(vec);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

interface EmbeddingResponse {
  data?: { embedding?: number[] }[];
}

/** 真实向量模型（通义 text-embedding-v3 等 OpenAI 兼容端点）；失败自动回落哈希向量 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const key = process.env.EMBEDDING_API_KEY;
  const baseURL = process.env.EMBEDDING_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  if (!key) return texts.map(hashedEmbedding);
  try {
    const res = await fetch(`${baseURL}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.EMBEDDING_MODEL || 'text-embedding-v3',
        input: texts,
        dimensions: EMBEDDING_DIM
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return texts.map(hashedEmbedding);
    const json = (await res.json()) as EmbeddingResponse;
    const out = (json.data ?? []).map((d) => d.embedding ?? []);
    return out.length === texts.length && out.every((v) => v.length > 0) ? out.map(normalize) : texts.map(hashedEmbedding);
  } catch {
    return texts.map(hashedEmbedding);
  }
}

export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}
