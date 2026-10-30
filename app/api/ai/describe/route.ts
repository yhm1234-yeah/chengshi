import type { FindingDraft, Severity } from '@/domain/types';
import { BIZ, fail, readJson } from '@/lib/api';
import { sseResponse, type SseMessage } from '@/lib/sse';
import { generateDescription } from '@/ai/chains/text';
import { sleep } from '@/lib/utils';
import { chunkText } from '@/ai/chains/chat';

interface Body {
  raw?: string;
  address?: string;
  district?: string;
  findings?: FindingDraft[];
  severity?: Severity;
  confidence?: number;
  ticketId?: string;
}

export async function POST(req: Request) {
  const body = await readJson<Body>(req, {});
  const raw = (body.raw ?? '').slice(0, 500);
  const findings = body.findings?.length
    ? body.findings
    : [{ type: 'T07' as const, severity: 'medium' as const, confidence: 0.5, evidence: [], desc: '待人工研判' }];

  if (!raw.trim() && !body.address) return fail(BIZ.VALIDATION, '缺少现场描述');

  async function* events(): AsyncGenerator<SseMessage> {
    yield { event: 'start', data: { stage: 'describe' } };
    yield { event: 'stage', data: { text: '正在脱敏并规范化描述…' } };
    const gen = await generateDescription({
      raw,
      address: body.address ?? '现场位置',
      district: body.district ?? '云溪区',
      findings,
      severity: body.severity ?? 'medium',
      confidence: body.confidence ?? 0.8,
      ticketId: body.ticketId ?? null
    });
    for (const piece of chunkText(gen.text, 8)) {
      yield { event: 'delta', data: { text: piece } };
      await sleep(18);
    }
    yield {
      event: 'result',
      data: {
        text: gen.text,
        runId: gen.runId,
        model: gen.model,
        latencyMs: gen.latencyMs,
        fallbackUsed: gen.fallbackUsed,
        privacyHits: gen.privacyHits
      }
    };
  }

  return sseResponse(events());
}
