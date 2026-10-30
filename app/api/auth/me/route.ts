import { clearSessionCookie, getSession, verifySessionToken } from '@/lib/auth';
import { ok } from '@/lib/api';
import { getStorage } from '@/storage';

export async function POST() {
  await clearSessionCookie();
  return ok({ loggedOut: true });
}

export async function GET(req: Request) {
  const header = req.headers.get('cookie') ?? '';
  const token = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('cs_session='))
    ?.slice('cs_session='.length);
  const session = verifySessionToken(token) ?? (await getSession());
  if (!session) return ok({ user: null });
  const user = getStorage().users.get(session.uid);
  if (!user) return ok({ user: null });
  return ok({
    user: {
      id: user.id,
      role: user.role,
      name: user.name,
      points: user.points,
      phoneTail: user.phoneTail
    }
  });
}
