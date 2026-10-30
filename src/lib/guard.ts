import type { Role, User } from '@/domain/types';
import { getSession } from '@/lib/auth';
import { getStorage } from '@/storage';

export interface AuthContext {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  user: User;
}

/** API 鉴权：未登录 401，角色不符 403（由调用方返回标准错误体） */
export async function requireUser(roles?: Role[]): Promise<AuthContext | null> {
  const session = await getSession();
  if (!session) return null;
  const user = getStorage().users.get(session.uid);
  if (!user) return null;
  if (roles && !roles.includes(user.role)) return null;
  return { session, user };
}
