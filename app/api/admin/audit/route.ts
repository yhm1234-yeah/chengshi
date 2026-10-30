import type { AiStage } from '@/domain/types';
import { BIZ, fail, ok } from '@/lib/api';
import { requireUser } from '@/lib/guard';
import { listAuditRuns } from '@/server/stats';

export async function GET(req: Request) {
  const auth = await requireUser(['staff', 'command']);
  if (!auth) return fail(BIZ.FORBIDDEN, '仅管理端可访问', 403);
  const url = new URL(req.url);
  const stage = (url.searchParams.get('stage') ?? '') as AiStage | '';
  const rows = listAuditRuns({
    code: url.searchParams.get('code') ?? undefined,
    stage: stage || undefined,
    model: url.searchParams.get('model') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
    fallbackOnly: url.searchParams.get('fallback') === '1',
    limit: Math.min(200, Number(url.searchParams.get('limit') ?? '60'))
  });
  return ok({ rows, total: rows.length });
}
