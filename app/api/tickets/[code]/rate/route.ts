import { BIZ, fail, ok, readJson } from '@/lib/api';
import { requireUser } from '@/lib/guard';
import { rateTicket, getTicketDetail } from '@/server/ticket-service';

interface Body {
  rating?: 'satisfied' | 'unsatisfied';
  tags?: string[];
  comment?: string;
}

export async function POST(req: Request, context: { params: Promise<{ code: string }> }) {
  const auth = await requireUser(['citizen']);
  if (!auth) return fail(BIZ.UNAUTHORIZED, '请先登录', 401);
  const { code } = await context.params;
  const body = await readJson<Body>(req, {});
  if (!body.rating) return fail(BIZ.VALIDATION, '请选择评价结果');

  try {
    const detail = await getTicketDetail(code);
    if (!detail) return fail(BIZ.NOT_FOUND, '工单不存在', 404);
    rateTicket(detail.id, auth.user.id, body.rating, body.tags ?? [], (body.comment ?? '').slice(0, 200));
    const updated = await getTicketDetail(detail.id);
    return ok({ detail: updated, points: auth.user.points });
  } catch (err) {
    return fail(BIZ.FSM_INVALID, err instanceof Error ? err.message : '评价失败');
  }
}
