import type { AgentStep, DispatchSummary } from '@/domain/types';
import { BIZ, fail, readJson } from '@/lib/api';
import { sseResponse, type SseMessage } from '@/lib/sse';
import { requireUser } from '@/lib/guard';
import { runDispatchAgent } from '@/ai/agent/runtime';
import { getStorage } from '@/storage';

interface Body {
  ticketId?: string;
  code?: string;
}

type ChannelItem = { type: 'step'; step: AgentStep } | { type: 'done'; summary: DispatchSummary } | { type: 'error'; message: string };

function channel<T>() {
  const buffer: T[] = [];
  let waiter: ((value: T | undefined) => void) | null = null;
  let closed = false;
  return {
    push(value: T) {
      if (waiter) {
        const w = waiter;
        waiter = null;
        w(value);
      } else buffer.push(value);
    },
    close() {
      closed = true;
      if (waiter) {
        const w = waiter;
        waiter = null;
        w(undefined);
      }
    },
    async *iterate(): AsyncGenerator<T> {
      while (true) {
        if (buffer.length) {
          yield buffer.shift() as T;
          continue;
        }
        if (closed) return;
        const value = await new Promise<T | undefined>((resolve) => {
          waiter = resolve;
        });
        if (value === undefined) return;
        yield value;
      }
    }
  };
}

export async function POST(req: Request) {
  const auth = await requireUser(['staff', 'command']);
  if (!auth) return fail(BIZ.FORBIDDEN, '仅坐席与指挥中心可触发分派', 403);
  const body = await readJson<Body>(req, {});
  const storage = getStorage();
  const ticket = body.ticketId ? storage.tickets.getById(body.ticketId) : body.code ? storage.tickets.getByCode(body.code.toUpperCase()) : undefined;
  if (!ticket) return fail(BIZ.NOT_FOUND, '工单不存在', 404);
  if (!['submitted', 'ai_filed', 'pending_review'].includes(ticket.status)) {
    return fail(BIZ.FSM_INVALID, '当前状态不允许重新分派');
  }
  const ticketId = ticket.id;
  const ticketCode = ticket.code;

  async function* events(): AsyncGenerator<SseMessage> {
    const ch = channel<ChannelItem>();
    runDispatchAgent(ticketId, {
      paceMs: 260,
      onStep: (step) => ch.push({ type: 'step', step })
    })
      .then((summary) => ch.push({ type: 'done', summary }))
      .catch((err: unknown) => ch.push({ type: 'error', message: err instanceof Error ? err.message : '分派失败' }))
      .finally(() => ch.close());

    yield { event: 'start', data: { ticketCode, ticketId } };
    for await (const item of ch.iterate()) {
      if (item.type === 'step') yield { event: 'step', data: { step: item.step } };
      else if (item.type === 'done') yield { event: 'result', data: { summary: item.summary } };
      else yield { event: 'error', data: { message: item.message } };
    }
    yield { event: 'end', data: { finished: true } };
  }

  return sseResponse(events());
}
