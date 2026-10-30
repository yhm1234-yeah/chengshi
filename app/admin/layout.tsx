'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  AlarmClock,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Cpu,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Monitor,
  ScrollText,
  Smartphone,
  X
} from 'lucide-react';
import { Avatar, DemoTag, Logo } from '@/components/ui/kit';
import { toast } from '@/components/ui/toast';
import { apiGet, apiPost } from '@/lib/client';
import { useMe } from '@/lib/useMe';
import { DEMO_ACCOUNTS, ROLE_META } from '@/domain/constants';
import type { StatsOverview } from '@/domain/types';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin', label: '工作台', icon: LayoutDashboard, exact: true },
  { href: '/admin/review', label: '复核台', icon: ClipboardCheck, badge: true },
  { href: '/admin/tickets', label: '工单', icon: FileText },
  { href: '/admin/overdue', label: '督办', icon: AlarmClock },
  { href: '/admin/audit', label: '审计', icon: ScrollText },
  { href: '/admin/knowledge', label: '知识库', icon: BookOpen },
  { href: '/admin/ai', label: 'AI 能力', icon: Cpu }
];

const PAGE_META: { prefix: string; title: string; crumb: string[] }[] = [
  { prefix: '/admin/review', title: '人工复核台', crumb: ['管理端', '复核台'] },
  { prefix: '/admin/tickets', title: '工单列表', crumb: ['管理端', '工单'] },
  { prefix: '/admin/overdue', title: '督办中心', crumb: ['管理端', '督办'] },
  { prefix: '/admin/audit', title: '审计中心', crumb: ['管理端', '审计'] },
  { prefix: '/admin/knowledge', title: '知识库', crumb: ['管理端', '知识库'] },
  { prefix: '/admin/ai', title: 'AI 能力中心', crumb: ['管理端', 'AI 能力'] },
  { prefix: '/admin', title: '运营工作台', crumb: ['管理端', '工作台'] }
];

function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)}****${phone.slice(7)}`;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loading } = useMe();
  const [pendingReview, setPendingReview] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let alive = true;
    apiGet<StatsOverview>('/api/admin/stats')
      .then((d) => {
        if (alive) setPendingReview(d.pendingReview);
      })
      .catch(() => {
        // 工作台统计不可用时不影响导航
      });
    return () => {
      alive = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (!loading && !me) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}&role=staff`);
    }
  }, [loading, me, pathname, router]);

  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  const meta = useMemo(() => {
    if (pathname.startsWith('/admin/tickets/') && pathname !== '/admin/tickets') {
      return { title: '工单详情', crumb: ['管理端', '工单', '详情'] };
    }
    return PAGE_META.find((m) => pathname === m.prefix || (m.prefix !== '/admin' && pathname.startsWith(m.prefix))) ?? PAGE_META[PAGE_META.length - 1];
  }, [pathname]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await apiPost('/api/auth/logout');
      window.location.href = '/login';
    } catch (err) {
      toast(err instanceof Error ? err.message : '退出失败', 'error');
      setLoggingOut(false);
    }
  }

  if (loading || !me) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F6F7FB]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          <div className="text-[12px] text-ink-400">正在进入管理端…</div>
        </div>
      </div>
    );
  }

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-[#F6F7FB]">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-ink-200/70 bg-white transition-transform duration-300 lg:translate-x-0',
          drawer ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <Link href="/admin" aria-label="城事管理端">
            <Logo size={32} />
          </Link>
          <button
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 lg:hidden"
            onClick={() => setDrawer(false)}
            aria-label="关闭导航"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-300">治理工作台</div>

        <nav className="scroll-thin flex-1 space-y-1 overflow-y-auto px-3">
          {NAV.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] transition',
                  active ? 'bg-brand-50 font-medium text-brand-700' : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800'
                )}
              >
                <item.icon className={cn('h-4 w-4 shrink-0', active ? 'text-brand-500' : 'text-ink-400 group-hover:text-ink-600')} />
                <span className="flex-1">{item.label}</span>
                {item.badge && pendingReview > 0 ? (
                  <span className="num rounded-full bg-danger-50 px-1.5 py-0.5 text-[10px] font-semibold text-danger-600">
                    {pendingReview}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-ink-200/70 p-3">
          <div className="rounded-xl bg-ink-50 p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-ink-400">演示账号</div>
            {DEMO_ACCOUNTS.filter((a) => a.role !== 'citizen').map((a) => (
              <div key={a.role} className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-[10px] text-ink-500">
                  {a.name} · {ROLE_META[a.role].label}
                </span>
                <span className="num text-[10px] text-ink-400">{maskPhone(a.phone)}</span>
              </div>
            ))}
            <div className="mt-2">
              <DemoTag className="px-2 py-0.5 text-[9px]" />
            </div>
          </div>

          <Link
            href="/screen"
            className="flex items-center gap-2 rounded-xl border border-ink-200 px-3 py-2 text-[12px] text-ink-600 transition hover:border-brand-200 hover:bg-brand-50/50 hover:text-brand-700"
          >
            <Monitor className="h-4 w-4 text-brand-500" />
            <span className="flex-1">指挥大屏</span>
            <ChevronRight className="h-3.5 w-3.5 text-ink-300" />
          </Link>
          <Link
            href="/m"
            className="flex items-center gap-2 rounded-xl border border-ink-200 px-3 py-2 text-[12px] text-ink-600 transition hover:border-teal-200 hover:bg-teal-50/50 hover:text-teal-700"
          >
            <Smartphone className="h-4 w-4 text-teal-500" />
            <span className="flex-1">市民端</span>
            <ChevronRight className="h-3.5 w-3.5 text-ink-300" />
          </Link>
        </div>
      </aside>

      {drawer ? (
        <button
          className="fixed inset-0 z-30 bg-ink-900/25 backdrop-blur-sm lg:hidden"
          onClick={() => setDrawer(false)}
          aria-label="关闭遮罩"
        />
      ) : null}

      <main className="min-h-screen lg:pl-[240px]">
        <header className="sticky top-0 z-20 border-b border-ink-200/70 bg-white/85 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3 px-4 lg:px-6">
            <button
              onClick={() => setDrawer(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50 lg:hidden"
              aria-label="打开导航"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-[10px] text-ink-400">
                {meta.crumb.map((c, i) => (
                  <span key={c} className="flex items-center gap-1">
                    {i > 0 ? <ChevronRight className="h-3 w-3 text-ink-300" /> : null}
                    <span className={i === meta.crumb.length - 1 ? 'text-ink-500' : ''}>{c}</span>
                  </span>
                ))}
              </div>
              <div className="mt-0.5 truncate text-[15px] font-semibold text-ink-900">{meta.title}</div>
            </div>

            <DemoTag className="hidden md:inline-flex" />

            <div className="flex items-center gap-2">
              <Avatar name={me.name} size={32} />
              <div className="hidden leading-tight sm:block">
                <div className="text-[12px] font-medium text-ink-800">{me.name}</div>
                <div className="text-[10px] text-ink-400">{ROLE_META[me.role].label}</div>
              </div>
            </div>

            <button onClick={logout} disabled={loggingOut} className="btn-ghost shrink-0 px-2.5 py-2 text-[12px]">
              {loggingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">退出登录</span>
            </button>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1440px] px-4 py-5 lg:px-6 lg:py-6">{children}</div>
      </main>
    </div>
  );
}
