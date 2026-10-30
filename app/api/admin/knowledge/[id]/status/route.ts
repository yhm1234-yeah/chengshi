import { BIZ, fail, ok, readJson } from '@/lib/api';
import { requireUser } from '@/lib/guard';
import { getStorage } from '@/storage';

interface Body {
  status?: 'active' | 'inactive';
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(['staff', 'command']);
  if (!auth) return fail(BIZ.FORBIDDEN, '仅管理端可维护知识库', 403);
  const { id } = await context.params;
  const body = await readJson<Body>(req, {});
  if (body.status !== 'active' && body.status !== 'inactive') return fail(BIZ.VALIDATION, '状态取值不合法');
  const storage = getStorage();
  const doc = storage.knowledge.getDoc(id);
  if (!doc) return fail(BIZ.NOT_FOUND, '文档不存在', 404);
  storage.knowledge.setDocStatus(id, body.status);
  return ok({ doc: { ...doc, status: body.status } });
}
