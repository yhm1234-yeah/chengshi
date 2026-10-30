import { hashPhone, setSessionCookie, verifyCode } from '@/lib/auth';
import { BIZ, fail, ok, readJson } from '@/lib/api';
import { getStorage } from '@/storage';
import type { Role } from '@/domain/types';

const PHONE_RE = /^1[3-9]\d{9}$/;
const DEMO_PHONES = new Set(['13800000000', '13900000000', '13700000000']);

interface LoginBody {
  phone?: string;
  code?: string;
  role?: Role;
  name?: string;
}

export async function POST(req: Request) {
  const body = await readJson<LoginBody>(req, {});
  const phone = (body.phone ?? '').trim();
  const code = (body.code ?? '').trim();
  if (!PHONE_RE.test(phone)) return fail(BIZ.VALIDATION, '请输入正确的手机号');
  if (!/^\d{6}$/.test(code)) return fail(BIZ.VALIDATION, '验证码为 6 位数字');

  const storage = getStorage();
  const user = storage.users.byPhoneHash(hashPhone(phone));
  const role: Role = body.role ?? user?.role ?? 'citizen';

  // 演示账号可用固定验证码，其他号码必须走验证码校验（60s 防刷 + 5 次锁 10 分钟）
  if (!DEMO_PHONES.has(phone)) {
    const check = verifyCode(phone, code);
    if (!check.ok) return fail(BIZ.VALIDATION, check.message ?? '验证码错误');
  }

  let target = user;
  if (!target) {
    target = {
      id: `u-${hashPhone(phone).slice(3, 12)}`,
      role: role === 'citizen' ? 'citizen' : role,
      name: body.name?.trim() || `市民${phone.slice(-4)}`,
      phoneHash: hashPhone(phone),
      phoneTail: phone.slice(-4),
      points: 0,
      createdAt: new Date().toISOString()
    };
    storage.users.list().push(target);
  }

  await setSessionCookie(target);
  return ok({
    user: {
      id: target.id,
      role: target.role,
      name: target.name,
      points: target.points,
      phoneTail: target.phoneTail
    }
  });
}
