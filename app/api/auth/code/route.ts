import { NextResponse } from 'next/server';
import { DEMO_CODE, requestCode } from '@/lib/auth';
import { BIZ, fail, ok, readJson } from '@/lib/api';

const PHONE_RE = /^1[3-9]\d{9}$/;

interface CodeBody {
  phone?: string;
}

export async function POST(req: Request) {
  const body = await readJson<CodeBody>(req, {});
  const phone = (body.phone ?? '').trim();
  if (!PHONE_RE.test(phone)) return fail(BIZ.VALIDATION, '请输入正确的 11 位手机号');
  const result = requestCode(phone);
  if (!result.ok) {
    return NextResponse.json(
      {
        code: BIZ.RATE_LIMITED,
        message: `请求过于频繁，请 ${result.retryAfter} 秒后重试`,
        data: { retryAfter: result.retryAfter },
        requestId: 'rl'
      },
      { status: 429 }
    );
  }
  return ok({ sent: true, devCode: DEMO_CODE, ttl: 300 });
}
