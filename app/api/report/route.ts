import type { ProblemType } from '@/domain/types';
import { BIZ, fail, ok, readJson } from '@/lib/api';
import { requireUser } from '@/lib/guard';
import { submitReport, getTicketDetail } from '@/server/ticket-service';
import { PROBLEM_TYPES } from '@/domain/constants';

interface Body {
  images?: { url: string; width: number; height: number; demoCase?: string }[];
  description?: string;
  lng?: number;
  lat?: number;
  address?: string;
  demoCase?: string;
  runId?: string;
  selectedType?: ProblemType;
  clientToken?: string;
}

const globalIdem = globalThis as unknown as { __chengshiIdem?: Map<string, string> };
function idem(): Map<string, string> {
  if (!globalIdem.__chengshiIdem) globalIdem.__chengshiIdem = new Map();
  return globalIdem.__chengshiIdem;
}

export async function POST(req: Request) {
  const auth = await requireUser(['citizen', 'staff', 'command']);
  if (!auth) return fail(BIZ.UNAUTHORIZED, '请先登录后上报', 401);
  const body = await readJson<Body>(req, {});
  const token = body.clientToken;
  if (token && idem().has(token)) {
    const code = idem().get(token) as string;
    const existing = await getTicketDetail(code);
    return ok({ ticket: existing, duplicated: true });
  }

  const images = (body.images ?? []).filter((i) => i && typeof i.url === 'string');
  if (!images.length) return fail(BIZ.VALIDATION, '请至少上传 1 张现场照片');
  if (images.length > 3) return fail(BIZ.VALIDATION, '最多上传 3 张照片');
  const selectedType = body.selectedType && PROBLEM_TYPES.includes(body.selectedType) ? body.selectedType : undefined;
  if (!selectedType && !body.runId) {
    return fail(BIZ.VALIDATION, '缺少 AI 识别结果，请重新识别或手动选择类型');
  }

  try {
    const result = await submitReport({
      userId: auth.user.id,
      images: images.map((i) => ({ url: i.url, width: Number(i.width) || 1280, height: Number(i.height) || 960, demoCase: i.demoCase })),
      description: (body.description ?? '').slice(0, 500),
      lng: typeof body.lng === 'number' ? body.lng : undefined,
      lat: typeof body.lat === 'number' ? body.lat : undefined,
      address: body.address?.slice(0, 120),
      demoCase: body.demoCase,
      runId: body.runId,
      selectedType
    });
    if (token) idem().set(token, result.ticket.code);
    return ok({
      ticket: result.detail,
      classification: result.classification,
      dispatch: result.dispatch,
      code: result.ticket.code,
      status: result.ticket.status,
      needsReview: result.ticket.needsReview
    });
  } catch (err) {
    return fail(BIZ.VALIDATION, err instanceof Error ? err.message : '上报失败');
  }
}
