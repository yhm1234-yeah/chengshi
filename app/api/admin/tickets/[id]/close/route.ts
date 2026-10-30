import { BIZ, fail, ok, readJson } from '@/lib/api';
import { requireUser } from '@/lib/guard';
import { closeTicket, getTicketDetail } from '@/server/ticket-service';

interface Body {
  note?: string;
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(['staff', 'command']);
  if (!auth) return fail(BIZ.FORBIDDEN, '仅管理端可办结', 403);
  const { id } = await context.params;
  const body = await readJson<Body>(req, {});
  try {
    closeTicket(id, `${auth.user.name}（${auth.user.role === 'command' ? '指挥中心' : '网格坐席'}）`, (body.note ?? '现场处置完成').slice(0, 200));
    const detail = await getTicketDetail(id);
    return ok({ detail });
  } catch (err) {
    return fail(BIZ.FSM_INVALID, err instanceof Error ? err.message : '办结失败');
  }
}
