import { BIZ, fail, ok, readJson } from '@/lib/api';
import { requireUser } from '@/lib/guard';
import { reassign, getTicketDetail } from '@/server/ticket-service';

interface Body {
  department?: string;
  note?: string;
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(['staff', 'command']);
  if (!auth) return fail(BIZ.FORBIDDEN, '仅坐席可改派', 403);
  const { id } = await context.params;
  const body = await readJson<Body>(req, {});
  if (!body.department?.trim()) return fail(BIZ.VALIDATION, '请选择改派部门');
  try {
    reassign(id, `${auth.user.name}（${auth.user.role === 'command' ? '指挥中心' : '网格坐席'}）`, body.department.slice(0, 60), (body.note ?? '').slice(0, 200));
    const detail = await getTicketDetail(id);
    return ok({ detail });
  } catch (err) {
    return fail(BIZ.FSM_INVALID, err instanceof Error ? err.message : '改派失败');
  }
}
