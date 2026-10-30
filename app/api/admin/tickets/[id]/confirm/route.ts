import { BIZ, fail, ok, readJson } from '@/lib/api';
import { requireUser } from '@/lib/guard';
import { confirmReview, getTicketDetail, type ConfirmChanges } from '@/server/ticket-service';

interface Body {
  changes?: ConfirmChanges[];
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(['staff', 'command']);
  if (!auth) return fail(BIZ.FORBIDDEN, '仅坐席可复核', 403);
  const { id } = await context.params;
  const body = await readJson<Body>(req, {});
  try {
    confirmReview(id, `${auth.user.name}（${auth.user.role === 'command' ? '指挥中心' : '网格坐席'}）`, body.changes ?? []);
    const detail = await getTicketDetail(id);
    return ok({ detail });
  } catch (err) {
    return fail(BIZ.FSM_INVALID, err instanceof Error ? err.message : '复核失败');
  }
}
