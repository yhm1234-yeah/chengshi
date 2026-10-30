import { BIZ, fail, ok, readJson } from '@/lib/api';
import { requireUser } from '@/lib/guard';
import { generateUrgeDraft } from '@/ai/chains/text';
import { getTicketDetail, urgeTicket } from '@/server/ticket-service';
import { getStorage } from '@/storage';

interface Body {
  note?: string;
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(['staff', 'command']);
  if (!auth) return fail(BIZ.FORBIDDEN, '仅管理端可发起督办', 403);
  const { id } = await context.params;
  const body = await readJson<Body>(req, {});
  const detail = await getTicketDetail(id);
  if (!detail) return fail(BIZ.NOT_FOUND, '工单不存在', 404);
  const active = detail.assignments.find((a) => a.state === 'active');
  if (!active) return fail(BIZ.FSM_INVALID, '该工单尚无生效分派，无法督办');
  const overdueHours = Math.max(0, (Date.now() - new Date(active.deadline).getTime()) / 3600000);
  const draft = await generateUrgeDraft({
    code: detail.code,
    title: detail.title,
    department: active.department,
    overdueHours,
    severity: detail.severity,
    ticketId: detail.id
  });
  urgeTicket(detail.id, `${auth.user.name}（${auth.user.role === 'command' ? '指挥中心' : '网格坐席'}）`, draft.text, draft.runId);
  return ok({
    draft: draft.text,
    runId: draft.runId,
    overdueHours: Number(overdueHours.toFixed(1)),
    department: active.department,
    notification: getStorage()
      .tickets.events(detail.id)
      .filter((e) => e.eventType === 'urge')
      .slice(-1)[0] ?? null,
    note: body.note ?? null
  });
}
