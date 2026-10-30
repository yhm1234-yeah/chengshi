import type { ProblemType, TicketStatus } from '@/domain/types';
import { BIZ, fail, ok } from '@/lib/api';
import { requireUser } from '@/lib/guard';
import { listAdminTickets } from '@/server/ticket-service';

export async function GET(req: Request) {
  const auth = await requireUser(['staff', 'command']);
  if (!auth) return fail(BIZ.FORBIDDEN, '仅管理端可访问', 403);
  const url = new URL(req.url);
  const status = (url.searchParams.get('status') ?? '').split(',').filter(Boolean) as TicketStatus[];
  const type = (url.searchParams.get('type') ?? '').split(',').filter(Boolean) as ProblemType[];
  const district = url.searchParams.get('district') ?? undefined;
  const q = url.searchParams.get('q') ?? undefined;
  const needsReviewParam = url.searchParams.get('needsReview');
  const page = Number(url.searchParams.get('page') ?? '1');
  const pageSize = Math.min(100, Number(url.searchParams.get('pageSize') ?? '20'));

  const { rows, total } = listAdminTickets({
    status: status.length ? status : undefined,
    type: type.length ? type : undefined,
    district: district || undefined,
    q: q || undefined,
    needsReview: needsReviewParam === null ? undefined : needsReviewParam === '1',
    page,
    pageSize
  });

  return ok({ rows, total, page, pageSize });
}
