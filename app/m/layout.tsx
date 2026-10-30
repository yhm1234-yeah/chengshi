'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Camera, FileText, MessageCircleHeart, UserRound, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMe } from '@/lib/useMe';
import { useEffect } from 'react';

const TABS = [
  { href: '/m', label: '首页', icon: Home },
  { href: '/m/tickets', label: '工单', icon: FileText },
  { href: '/m/report', label: '上报', icon: Camera, primary: true },
  { href: '/m/chat', label: '助手', icon: MessageCircleHeart },
  { href: '/m/me', label: '我的', icon: UserRound }
];

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loading } = useMe();

  useEffect(() => {
    if (!loading && !me) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}&role=citizen`);
    }
  }, [loading, me, pathname, router]);

  if (loading || !me) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F4F5FA]">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EDEFF6] lg:flex lg:items-center lg:justify-center lg:py-8">
      <div className="phone-shell flex flex-col">
        <div className="phone-notch" />
        <div className="flex items-center justify-between bg-white px-5 pb-1.5 pt-3 text-[11px] text-ink-500">
          <span className="num font-medium text-ink-700">9:41</span>
          <span className="flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-ink-400" />
            <span className="h-1 w-1 rounded-full bg-ink-400" />
            <span className="tracking-tighter">5G</span>
            <span className="ml-1 inline-block h-2 w-4 rounded-sm border border-ink-300">
              <span className="block h-full w-3 bg-ink-500" />
            </span>
          </span>
        </div>

        <main className="no-scrollbar relative flex-1 overflow-y-auto bg-[#F7F8FC]">{children}</main>

        <nav className="relative z-30 flex items-center justify-around border-t border-ink-200/70 bg-white/95 px-3 pb-4 pt-2 backdrop-blur">
          {TABS.map((tab) => {
            const active = tab.href === '/m' ? pathname === '/m' : pathname.startsWith(tab.href);
            if (tab.primary) {
              return (
                <Link key={tab.href} href={tab.href} className="-mt-6 flex flex-col items-center gap-1">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_10px_24px_rgba(76,93,240,.38)] transition active:scale-95">
                    <tab.icon className="h-5 w-5" />
                  </div>
                  <span className={cn('text-[10px]', active ? 'text-brand-600' : 'text-ink-400')}>{tab.label}</span>
                </Link>
              );
            }
            return (
              <Link key={tab.href} href={tab.href} className="flex flex-col items-center gap-1 py-1">
                <tab.icon className={cn('h-[19px] w-[19px]', active ? 'text-brand-600' : 'text-ink-400')} strokeWidth={active ? 2.2 : 1.8} />
                <span className={cn('text-[10px]', active ? 'font-medium text-brand-600' : 'text-ink-400')}>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
