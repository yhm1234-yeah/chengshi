import { BIZ, fail, ok } from '@/lib/api';
import { extractLocateHints } from '@/ai/chains/text';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lng = Number(url.searchParams.get('lng') ?? '120.164');
  const lat = Number(url.searchParams.get('lat') ?? '30.281');
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return fail(BIZ.VALIDATION, '坐标格式不正确');
  const hints = await extractLocateHints(lng, lat);
  return ok({ hints, source: 'vision-ocr(mock)' });
}
