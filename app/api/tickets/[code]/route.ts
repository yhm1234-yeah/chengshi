import { BIZ, fail, ok } from '@/lib/api';
import { requireUser } from '@/lib/guard';
import { getTicketDetail } from '@/server/ticket-service';
import { getStorage } from '@/storage';

export async function GET(_req: Request, context: { params: Promise<{ code: string }> }) {
  const auth = await requireUser();
  if (!auth) return fail(BIZ.UNAUTHORIZED, '请先登录', 401);
  const { code } = await context.params;
  const detail = await getTicketDetail(code);
  if (!detail) return fail(BIZ.NOT_FOUND, '工单不存在', 404);
  if (auth.user.role === 'citizen' && detail.createdBy !== auth.user.id) {
    return fail(BIZ.FORBIDDEN, '无权查看他人工单', 403);
  }
  return ok({
    detail,
    creator: getStorage().users.get(detail.createdBy)?.name ?? '市民'
  });
}
