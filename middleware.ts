import { NextResponse, type NextRequest } from 'next/server';

// 路由级粗粒度鉴权：详细权限在领域层/接口层再次校验
const COOKIE = 'cs_session';

interface LightSession {
  role?: string;
  exp?: number;
}

function decode(token: string | undefined): LightSession | null {
  if (!token) return null;
  const body = token.split('.')[0];
  if (!body) return null;
  try {
    const json = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as LightSession;
    if (!json.exp || json.exp < Date.now()) return null;
    return json;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = decode(req.cookies.get(COOKIE)?.value);

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!session || (session.role !== 'staff' && session.role !== 'command')) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.search = `?next=${encodeURIComponent(pathname)}&role=staff`;
      return NextResponse.redirect(url);
    }
  }

  const citizenPaths = ['/m/report', '/m/tickets', '/m/chat', '/m/honors'];
  if (citizenPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!session || session.role !== 'citizen') {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.search = `?next=${encodeURIComponent(pathname + search)}&role=citizen`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/m/report', '/m/tickets', '/m/tickets/:path*', '/m/chat', '/m/honors']
};
