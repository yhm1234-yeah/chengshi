import { BIZ, fail, ok, readJson } from '@/lib/api';
import { requireUser } from '@/lib/guard';
import { rejectReview, getTicketDetail } from '@/server/ticket-service';

interface Body {
  reason?: string;
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(['staff', 'command']);
  if (!auth) return fail(BIZ.FORBIDDEN, '仅坐席可驳回', 403);
  const { id } = await context.params;
  const body = await readJson<Body>(req, {});
  if (!body.reason?.trim()) return fail(BIZ.VALIDATION, '驳回必须填写理由');
  try {
    rejectReview(id, `${auth.user.name}（${auth.user.role === 'command' ? '指挥中心' : '网格坐席'}）`, body.reason.slice(0, 200));
    const detail = await getTicketDetail(id);
    return ok({ detail });
  } catch (err) {
    return fail(BIZ.FSM_INVALID, err instanceof Error ? err.message : '驳回失败');
  }
}
