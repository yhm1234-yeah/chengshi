import { BIZ, fail, readJson } from '@/lib/api';
import { sseResponse, type SseMessage } from '@/lib/sse';
import { runChat, chunkText } from '@/ai/chains/chat';
import { requireUser } from '@/lib/guard';
import { sleep } from '@/lib/utils';
import { getStorage } from '@/storage';

interface Body {
  message?: string;
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth) return fail(BIZ.UNAUTHORIZED, '请先登录', 401);
  const body = await readJson<Body>(req, {});
  const message = (body.message ?? '').trim().slice(0, 300);
  if (!message) return fail(BIZ.VALIDATION, '请输入问题');

  const output = await runChat({ message, userId: auth.user.id, role: auth.user.role });
  const run = getStorage().ai.getRun(output.runId);

  async function* events(): AsyncGenerator<SseMessage> {
    yield { event: 'start', data: { intent: output.result.intent, runId: output.runId } };
    await sleep(120);
    for (const piece of chunkText(output.streamText, 4)) {
      yield { event: 'delta', data: { text: piece } };
      await sleep(16);
    }
    yield {
      event: 'citations',
      data: { citations: output.result.citations, grounded: output.result.grounded }
    };
    yield { event: 'tickets', data: { tickets: output.result.tickets } };
    yield {
      event: 'done',
      data: { result: output.result, runId: output.runId, latencyMs: run?.latencyMs ?? 0 }
    };
  }

  return sseResponse(events());
}
