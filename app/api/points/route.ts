import { BIZ, fail, ok } from '@/lib/api';
import { requireUser } from '@/lib/guard';
import { getStorage } from '@/storage';

export async function GET() {
  const auth = await requireUser(['citizen']);
  if (!auth) return fail(BIZ.UNAUTHORIZED, '请先登录', 401);
  const storage = getStorage();
  const ledger = storage.users.ledger(auth.user.id);
  const tickets = storage.tickets.list({ createdBy: auth.user.id, pageSize: 500 }).items;
  const rated = tickets.filter((t) => t.status === 'rated').length;
  return ok({
    points: auth.user.points,
    ledger,
    stats: {
      reports: tickets.length,
      adopted: tickets.filter((t) => t.status !== 'submitted').length,
      rated,
      satisfaction: rated ? 1 : 0
    }
  });
}
