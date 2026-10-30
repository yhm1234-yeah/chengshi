import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { Role, User } from '@/domain/types';
import { hash32 } from '@/lib/utils';

const COOKIE_NAME = 'cs_session';
const SECRET = process.env.AUTH_SECRET || 'chengshi-demo-secret';
const SESSION_DAYS = 7;

export interface Session {
  uid: string;
  role: Role;
  name: string;
  exp: number;
}

interface CodeState {
  lastSentAt: number;
  attempts: number;
  lockedUntil: number;
}

const globalAuth = globalThis as unknown as { __chengshiCodeStates?: Map<string, CodeState> };
function codeStates(): Map<string, CodeState> {
  if (!globalAuth.__chengshiCodeStates) globalAuth.__chengshiCodeStates = new Map();
  return globalAuth.__chengshiCodeStates;
}

export const DEMO_CODE = '123456';

export function hashPhone(phone: string): string {
  return `ph_${hash32(phone).toString(16)}`;
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function createSessionToken(user: Pick<User, 'id' | 'role' | 'name'>): string {
  const payload: Session = {
    uid: user.id,
    role: user.role,
    name: user.name,
    exp: Date.now() + SESSION_DAYS * 24 * 3600 * 1000
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expect = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Session;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** 路由处理器 / Server Component 中读取当前会话 */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySessionToken(store.get(COOKIE_NAME)?.value);
}

export async function setSessionCookie(user: Pick<User, 'id' | 'role' | 'name'>): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 3600,
    secure: process.env.NODE_ENV === 'production'
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export const SESSION_COOKIE = COOKIE_NAME;

// ---------- 验证码策略：60s 防刷 / 连续 5 次失败锁 10 分钟 ----------

export function requestCode(phone: string): { ok: boolean; retryAfter?: number; devCode?: string } {
  const state = codeStates().get(phone) ?? { lastSentAt: 0, attempts: 0, lockedUntil: 0 };
  const t = Date.now();
  if (state.lockedUntil > t) return { ok: false, retryAfter: Math.ceil((state.lockedUntil - t) / 1000) };
  if (t - state.lastSentAt < 60_000) return { ok: false, retryAfter: Math.ceil((60_000 - (t - state.lastSentAt)) / 1000) };
  state.lastSentAt = t;
  state.attempts = 0;
  codeStates().set(phone, state);
  return { ok: true, devCode: DEMO_CODE };
}

export function verifyCode(phone: string, code: string): { ok: boolean; message?: string; lockedSeconds?: number } {
  const state = codeStates().get(phone) ?? { lastSentAt: 0, attempts: 0, lockedUntil: 0 };
  const t = Date.now();
  if (state.lockedUntil > t) {
    return { ok: false, message: '尝试次数过多，手机号已临时锁定', lockedSeconds: Math.ceil((state.lockedUntil - t) / 1000) };
  }
  if (code !== DEMO_CODE) {
    state.attempts += 1;
    if (state.attempts >= 5) {
      state.lockedUntil = t + 10 * 60_000;
      state.attempts = 0;
      codeStates().set(phone, state);
      return { ok: false, message: '连续 5 次验证码错误，已锁定 10 分钟', lockedSeconds: 600 };
    }
    codeStates().set(phone, state);
    return { ok: false, message: `验证码不正确，还可尝试 ${5 - state.attempts} 次` };
  }
  state.attempts = 0;
  state.lockedUntil = 0;
  codeStates().set(phone, state);
  return { ok: true };
}
