'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Award, ChevronRight, Gift, Loader2, LogOut, Phone, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { Avatar, DemoTag } from '@/components/ui/kit';
import { toast } from '@/components/ui/toast';
import { apiGet, apiPost } from '@/lib/client';
import { useMe } from '@/lib/useMe';
import type { PointsLedger } from '@/domain/types';
import { fmtDateTime } from '@/lib/format';

interface PointsResponse {
  points: number;
  ledger: PointsLedger[];
  stats: { reports: number; adopted: number; rated: number; satisfaction: number };
}

const LEVELS = [
  { min: 0, name: '城市观察员', next: 100 },
  { min: 100, name: '城市合伙人', next: 300 },
  { min: 300, name: '城市守护者', next: 600 },
  { min: 600, name: '金牌市民', next: 1000 },
  { min: 1000, name: '荣誉市民', next: 2000 }
];

export default function MePage() {
  const { me, refresh } = useMe();
  const [data, setData] = useState<PointsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<PointsResponse>('/api/points')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const points = data?.points ?? me?.points ?? 0;
  const level = [...LEVELS].reverse().find((l) => points >= l.min) ?? LEVELS[0];
  const progress = Math.min(100, ((points - level.min) / (level.next - level.min)) * 100);

  async function logout() {
    try {
      await apiPost('/api/auth/logout');
      refresh();
      window.location.href = '/login';
    } catch {
      toast('退出失败', 'error');
    }
  }

  return (
    <div className="min-h-full pb-6">
      <div className="relative overflow-hidden bg-gradient-to-b from-brand-700 via-brand-600 to-brand-500 px-5 pb-14 pt-6 text-white">
        <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full border border-white/15" />
        <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3">
          <Avatar name={me?.name ?? '市民'} size={52} />
          <div>
            <div className="text-[18px] font-semibold">{me?.name ?? '市民'}</div>
            <div className="mt-1 flex items-center gap-1 text-[10px] text-white/70">
              <Phone className="h-3 w-3" /> 尾号 {me?.phoneTail ?? '0000'} · 市民账号
            </div>
          </div>
          <span className="ml-auto rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px]">Lv.{LEVELS.indexOf(level) + 1}</span>
        </div>
      </div>

      <div className="mx-5 -mt-10 rounded-2xl border border-ink-200/70 bg-white p-4 shadow-card">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] text-ink-400">我的城市积分</div>
            <div className="num mt-1 text-[30px] font-semibold leading-none text-ink-900">{points}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-medium text-brand-600">{level.name}</div>
            <div className="mt-0.5 text-[9px] text-ink-400">距离下一级还差 {Math.max(0, level.next - points)} 分</div>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-teal-500 transition-all duration-700" style={{ width: `${Math.max(4, progress)}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-3 divide-x divide-ink-100 border-t border-ink-100 pt-3 text-center">
          {[
            { k: '上报', v: data?.stats.reports ?? 0 },
            { k: '立案', v: data?.stats.adopted ?? 0 },
            { k: '已评价', v: data?.stats.rated ?? 0 }
          ].map((s) => (
            <div key={s.k}>
              <div className="num text-[17px] font-semibold text-ink-900">{s.v}</div>
              <div className="mt-0.5 text-[9px] text-ink-400">{s.k}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 px-5">
        {[
          { href: '/m/report', icon: Sparkles, label: '随手拍上报', sub: '采纳 +5 积分', tone: 'bg-brand-50 text-brand-600' },
          { href: '/m/tickets', icon: Star, label: '评价工单', sub: '好评 +10 积分', tone: 'bg-amber-50 text-amber-600' },
          { href: '/m/chat', icon: ShieldCheck, label: '办理助手', sub: '政策与时限', tone: 'bg-teal-50 text-teal-600' },
          { href: '/', icon: Award, label: '关于城事', sub: '演示说明', tone: 'bg-ink-100 text-ink-600' }
        ].map((item) => (
          <Link key={item.href} href={item.href} className="flex items-center gap-2.5 rounded-2xl border border-ink-200/70 bg-white p-3.5 shadow-soft transition active:scale-[.98]">
            <div className={`grid h-9 w-9 place-items-center rounded-xl ${item.tone}`}>
              <item.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-ink-800">{item.label}</div>
              <div className="mt-0.5 text-[9px] text-ink-400">{item.sub}</div>
            </div>
            <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-ink-300" />
          </Link>
        ))}
      </div>

      <div className="mt-5 px-5">
        <div className="flex items-center justify-between">
          <div className="text-[14px] font-semibold text-ink-900">积分明细</div>
          <span className="text-[10px] text-ink-400">共 {data?.ledger.length ?? 0} 条</span>
        </div>

        <div className="mt-2.5 overflow-hidden rounded-2xl border border-ink-200/70 bg-white">
          {loading ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
            </div>
          ) : !data?.ledger.length ? (
            <div className="py-8 text-center text-[11px] text-ink-400">暂无积分记录，去上报获得第一笔积分</div>
          ) : (
            <div className="divide-y divide-ink-100">
              {data.ledger.slice(0, 20).map((l) => (
                <div key={l.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-teal-50 text-teal-600">
                      <Gift className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-ink-700">{l.reason}</div>
                      <div className="mt-0.5 num text-[9px] text-ink-400">{l.refId} · {fmtDateTime(l.createdAt)}</div>
                    </div>
                  </div>
                  <span className={l.delta >= 0 ? 'num text-[12px] font-semibold text-teal-600' : 'num text-[12px] font-semibold text-danger-600'}>
                    {l.delta >= 0 ? '+' : ''}{l.delta}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-2 px-5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-[10px] leading-relaxed text-amber-800">
          演示账号：138 0000 0000 · 验证码 123456。积分为演示数据，不可兑换真实权益。
        </div>
        <button onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-ink-200 bg-white py-3 text-[12px] text-ink-600">
          <LogOut className="h-3.5 w-3.5" /> 退出登录
        </button>
      </div>

      <div className="mt-4 flex justify-center">
        <DemoTag />
      </div>
    </div>
  );
}
