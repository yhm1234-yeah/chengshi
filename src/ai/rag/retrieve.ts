import type { KnowledgeChunk } from '@/domain/types';
import { THRESHOLDS } from '@/domain/constants';
import { cosine, embedQuery } from '@/ai/providers/embedding';
import { getDocTitle } from './knowledge';
import { getStorage } from '@/storage';

export interface RetrievalHit {
  chunk: KnowledgeChunk;
  docTitle: string;
  score: number;
  vectorScore: number;
  keywordScore: number;
  reason: string;
}

export interface RetrievalResult {
  query: string;
  hits: RetrievalHit[];
  accepted: boolean;
  bestScore: number;
  candidates: RetrievalHit[];
}

function keywordScore(query: string, chunk: KnowledgeChunk): { score: number; hits: string[] } {
  const hits: string[] = [];
  for (const kw of chunk.keywords) {
    if (query.includes(kw)) hits.push(kw);
  }
  // 关键词命中优先；再看二元片段重合作为弱信号
  const q = query.replace(/\s/g, '');
  let overlap = 0;
  for (let i = 0; i < q.length - 1; i += 1) {
    if (chunk.content.includes(q.slice(i, i + 2))) overlap += 1;
  }
  const score = Math.min(1, hits.length * 0.45 + overlap * 0.02);
  return { score, hits };
}

/**
 * 混合检索：向量 Top-8 ∪ 关键词 Top-8 → RRF(k=60) 合并 → 取 Top-3
 * 无候选或最高相关性低于阈值 → accepted=false（上层必须拒答）
 */
export async function retrieve(query: string, limit: number = THRESHOLDS.ragTopK): Promise<RetrievalResult> {
  const storage = getStorage();
  const chunks = storage.knowledge.chunks().filter((c) => c.status === 'active');
  if (!chunks.length) {
    return { query, hits: [], accepted: false, bestScore: 0, candidates: [] };
  }

  const queryVec = await embedQuery(query);
  const vectorRanked = chunks
    .map((chunk) => ({ chunk, vectorScore: cosine(queryVec, chunk.embedding) }))
    .sort((a, b) => b.vectorScore - a.vectorScore)
    .slice(0, 8);

  const keywordRanked = chunks
    .map((chunk) => ({ chunk, ...keywordScore(query, chunk) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const rrf = new Map<string, { chunk: KnowledgeChunk; vectorScore: number; keywordScore: number; score: number }>();
  vectorRanked.forEach((item, idx) => {
    rrf.set(item.chunk.id, {
      chunk: item.chunk,
      vectorScore: item.vectorScore,
      keywordScore: 0,
      score: 1 / (60 + idx + 1)
    });
  });
  keywordRanked.forEach((item, idx) => {
    const prev = rrf.get(item.chunk.id);
    const add = 1 / (60 + idx + 1);
    if (prev) {
      prev.keywordScore = item.score;
      prev.score += add;
    } else {
      rrf.set(item.chunk.id, { chunk: item.chunk, vectorScore: 0, keywordScore: item.score, score: add });
    }
  });

  const candidates = Array.from(rrf.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => ({
      chunk: item.chunk,
      docTitle: getDocTitle(item.chunk.docId),
      score: item.score,
      vectorScore: item.vectorScore,
      keywordScore: item.keywordScore,
      reason:
        item.keywordScore >= 0.45
          ? '关键词精确命中 + 向量语义召回'
          : item.vectorScore >= 0.2
            ? '向量语义召回命中'
            : '弱相关召回'
    }));

  const typicalCosine = candidates.length ? Math.max(...candidates.map((c) => c.vectorScore)) : 0;
  const typicalKeyword = candidates.length ? Math.max(...candidates.map((c) => c.keywordScore)) : 0;
  const bestScore = Math.max(typicalCosine, typicalKeyword * 0.9);
  const accepted = bestScore >= THRESHOLDS.ragScore && candidates.length > 0;
  const hits = candidates.slice(0, limit);

  return { query, hits, accepted, bestScore, candidates };
}

/** 立案时生成《办理指引》：按类型检索职责与时限条款 */
export async function buildGuide(typeLabel: string): Promise<RetrievalHit[]> {
  const result = await retrieve(`${typeLabel} 职责 承办部门 时限`, 3);
  return result.accepted ? result.hits : [];
}
