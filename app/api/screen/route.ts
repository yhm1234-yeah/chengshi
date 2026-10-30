import { sseResponse, type SseMessage } from '@/lib/sse';
import { computeScreen } from '@/server/stats';
import { sleep } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  async function* events(): AsyncGenerator<SseMessage> {
    for (let i = 0; i < 12; i += 1) {
      yield { event: i === 0 ? 'init' : 'tick', data: computeScreen() as unknown as Record<string, unknown> };
      await sleep(5000);
    }
    yield { event: 'end', data: { finished: true } };
  }
  return sseResponse(events());
}
