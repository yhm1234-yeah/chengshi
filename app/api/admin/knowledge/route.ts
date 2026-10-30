import { BIZ, fail, ok } from '@/lib/api';
import { requireUser } from '@/lib/guard';
import { getStorage } from '@/storage';

export async function GET() {
  const auth = await requireUser(['staff', 'command']);
  if (!auth) return fail(BIZ.FORBIDDEN, '仅管理端可访问', 403);
  const storage = getStorage();
  const docs = storage.knowledge.docs().map((d) => ({
    ...d,
    chunkCount: storage.knowledge.chunks().filter((c) => c.docId === d.id).length,
    status: d.status
  }));
  return ok({ docs });
}
