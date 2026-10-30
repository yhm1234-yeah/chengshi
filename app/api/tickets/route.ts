import type { TicketStatus } from '@/domain/types';
import { BIZ, fail, ok } from '@/lib/api';
import { requireUser } from '@/lib/guard';
import { getStorage } from '@/storage';
import { toAdminRow } from '@/server/ticket-service';

export async function GET(req: Request) {
  const auth = await requireUser();
  if (!auth) return fail(BIZ.UNAUTHORIZED, '请先登录', 401);
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  const statuses = (url.searchParams.get('status') ?? '').split(',').filter(Boolean) as TicketStatus[];
  const page = Number(url.searchParams.get('page') ?? '1');
  const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
  const mine = url.searchParams.get('mine') === '1' || auth.user.role === 'citizen';

  const { items, total } = getStorage().tickets.list({
    createdBy: mine ? auth.user.id : undefined,
    status: statuses.length ? statuses : undefined,
    q,
    page,
    pageSize
  });

  return ok({
    items: items.map((t) => {
      const row = toAdminRow(t);
      return {
        ...t,
        department: row.department,
        deadline: row.deadline,
        overdue: row.overdue,
        findingsCount: row.findings
      };
    }),
    total,
    page,
    pageSize
  });
}
