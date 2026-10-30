import { ok } from '@/lib/api';
import { getStorage } from '@/storage';

export async function GET() {
  const storage = getStorage();
  return ok({
    status: 'ok',
    mode: 'demo',
    disclaimer: '演示数据，非真实政务系统',
    storage: {
      driver: process.env.STORAGE_DRIVER || 'mock',
      tickets: storage.tickets.all().length,
      runs: storage.ai.allRuns().length,
      docs: storage.knowledge.docs().length,
      chunks: storage.knowledge.chunks().length
    },
    providers: {
      vlm: process.env.VLM_API_KEY ? 'live' : 'mock',
      llm: process.env.LLM_API_KEY ? 'live' : 'mock',
      embedding: process.env.EMBEDDING_API_KEY ? 'live' : 'hashed',
      amap: process.env.NEXT_PUBLIC_AMAP_KEY ? 'live' : 'fallback-svg'
    },
    thresholds: {
      confidence: 0.75,
      splitConfidence: 0.7,
      ragScore: 0.2
    },
    updatedAt: new Date().toISOString()
  });
}
