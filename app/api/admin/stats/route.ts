import { BIZ, fail, ok } from '@/lib/api';
import { requireUser } from '@/lib/guard';
import { computeStats } from '@/server/stats';

export async function GET() {
  const auth = await requireUser(['staff', 'command']);
  if (!auth) return fail(BIZ.FORBIDDEN, '仅管理端可访问', 403);
  return ok(computeStats());
}
