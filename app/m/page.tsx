'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Camera, ChevronRight, ClipboardList, Gift, MessageCircleHeart, MapPin, Sparkles, TrendingUp } from 'lucide-react';
import { Avatar, StatusBadge, TypeBadge, DemoTag } from '@/components/ui/kit';
import { CityMap } from '@/components/CityMap';
import { useMe } from '@/lib/useMe';
import { apiGet } from '@/lib/client';
import type { ProblemType, TicketStatus } from '@/domain/types';
import { fmtRelative } from '@/lib/format';
import { GRIDS } from '@/domain/constants';

interface MyTicket {
  id: string;
  code: string;
  title: string;
  type: ProblemType;
  status: TicketStatus;
  createdAt: string;
  address: string;
  severity: 'low' | 'medium' | 'urgent';
}

interface ScreenData {
  totalTickets: number;
  metrics: { todayReports: number; autoFileRate: number; avgResponseHours: number; completionRate: number };
  districtRanking: { district: string; count: number }[];
  heatPoints: { lng: number; lat: number; weight: number; severity: 'low' | 'medium' | 'urgent' }[];
}

const STATUS_HINT: Record<string, string> = {
  pending_review: 'AI 已立案，坐席复核中',
  assigned: '已分派至承办部门',
  processing: '承办部门处置中',
  closed: '已办结，待您评价',
  rated: '已完成评价',
  reopened: '督办重办中',
  ai_filed: 'AI 已完成立案',
  submitted: '已提交，等待 AI 识别'
};

export default function CitizenHome() {
  const { me } = useMe();
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [screen, setScreen] = useState<ScreenData | null>(null);

  useEffect(() => {
    apiGet<{ items: MyTicket[] }>('/api/tickets?mine=1&pageSize=3')
      .then((d) => setTickets(d.items))
      .catch(() => setTickets([]));
    apiGet<ScreenData>('/api/screen/summary')
      .then(setScreen)
      .catch(() => setScreen(null));
  }, []);

  const grid = GRIDS[0];

  return (
    <div className="pb-6">
      <div className="relative overflow-hidden bg-white px-5 pb-8 pt-4">
        <div className="absolute right-[-30px] top-[-40px] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(76,93,240,.16),transparent_70%)]" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="text-[11px] text-ink-400">上午好，今天也要好好生活</div>
            <div className="mt-1 flex items-center gap-2 text-[22px] font-semibold text-ink-900">
              {me?.name ?? '市民'}
              <span className="text-[16px]">👋</span>
            </div>
          </div>
          <Avatar name={me?.name ?? '城'} size={40} />
        </div>

        <div className="relative mt-5 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 p-5 text-white shadow-[0_16px_36px_rgba(76,93,240,.28)]">
          <div className="absolute -right-6 -top-8 h-32 w-32 rounded-full border border-white/15" />
          <div className="absolute -bottom-10 -left-6 h-32 w-32 rounded-full border border-white/10" />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="text-[11px] text-white/70">我的城市积分</div>
              <div className="num mt-1 text-[34px] font-semibold leading-none">{me?.points ?? 0}</div>
              <div className="mt-2 text-[10px] text-white/70">上报被采纳 +5 · 办结好评 +10</div>
            </div>
            <div className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px]">
              Lv.{Math.max(1, Math.floor((me?.points ?? 0) / 100) + 1)} 城市合伙人
            </div>
          </div>
          <div className="relative mt-4 flex gap-2">
            <Link href="/m/report" className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-[12px] font-semibold text-brand-700">
              <Camera className="h-3.5 w-3.5" /> 随手拍上报
            </Link>
            <Link href="/m/me" className="flex items-center justify-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 text-[12px] text-white">
              <Gift className="h-3.5 w-3.5" /> 积分
            </Link>
          </div>
        </div>
      </div>

      <div className="px-5">
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {[
            { href: '/m/report', icon: Camera, label: '我要上报', sub: '拍照即立案', tone: 'bg-brand-50 text-brand-600' },
            { href: '/m/tickets', icon: ClipboardList, label: '我的工单', sub: `${tickets.length} 件进行中`, tone: 'bg-teal-50 text-teal-600' },
            { href: '/m/chat', icon: MessageCircleHeart, label: '办理助手', sub: '政策有问必答', tone: 'bg-amber-50 text-amber-600' }
          ].map((item) => (
            <Link key={item.href} href={item.href} className="rounded-2xl border border-ink-200/70 bg-white p-3 text-center shadow-soft transition active:scale-[.98]">
              <div className={`mx-auto grid h-9 w-9 place-items-center rounded-xl ${item.tone}`}>
                <item.icon className="h-4.5 w-4.5" />
              </div>
              <div className="mt-2 text-[12px] font-semibold text-ink-800">{item.label}</div>
              <div className="mt-0.5 text-[9px] text-ink-400">{item.sub}</div>
            </Link>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="text-[15px] font-semibold text-ink-900">最近上报</div>
          <Link href="/m/tickets" className="flex items-center text-[11px] text-ink-400">
            全部 <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="mt-3 space-y-2.5">
          {tickets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-200 bg-white py-8 text-center">
              <div className="text-[13px] text-ink-500">还没有上报记录</div>
              <Link href="/m/report" className="mt-2 inline-flex text-[12px] font-medium text-brand-600">
                去拍第一张 →
              </Link>
            </div>
          ) : (
            tickets.map((t) => (
              <Link
                key={t.id}
                href={`/m/tickets/${t.code}`}
                className="block rounded-2xl border border-ink-200/70 bg-white p-3.5 shadow-soft transition active:scale-[.99]"
              >
                <div className="flex items-center justify-between">
                  <TypeBadge type={t.type} size="sm" />
                  <StatusBadge status={t.status} size="sm" />
                </div>
                <div className="mt-2 text-[13px] font-semibold text-ink-800">{t.title}</div>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-ink-400">
                  <MapPin className="h-3 w-3" /> {t.address}
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-ink-100 pt-2.5">
                  <span className="text-[10px] text-ink-400">{STATUS_HINT[t.status] ?? ''}</span>
                  <span className="text-[10px] text-ink-300">{fmtRelative(t.createdAt)}</span>
                </div>
              </Link>
            ))
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-ink-200/70 bg-white shadow-soft">
          <div className="flex items-center justify-between px-4 pb-1 pt-4">
            <div>
              <div className="text-[13px] font-semibold text-ink-800">我所在的城市</div>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-ink-400">
                <MapPin className="h-3 w-3 text-brand-500" /> {grid.district} · {grid.street}（{grid.code}）
              </div>
            </div>
            <div className="text-right">
              <div className="num text-[20px] font-semibold text-ink-900">{screen?.metrics.todayReports ?? '—'}</div>
              <div className="text-[9px] text-ink-400">今日上报</div>
            </div>
          </div>
          <CityMap
            className="mx-3 mb-3 mt-2 h-[170px]"
            points={(screen?.heatPoints ?? []).slice(0, 20)}
            activePoint={grid.center}
            showLabels={false}
            showGrid={false}
          />
        </div>

        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-brand-100 bg-brand-50/70 p-3.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-brand-600">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[12px] font-semibold text-brand-800">AI 今日提示</div>
            <div className="mt-0.5 text-[10px] leading-relaxed text-brand-700/80">
              雨后将出现积水高峰，发现积水请优先上报，紧急工单 1 小时到场。
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
        {['本周办结', '平均响应'].map((label, i) => (
            <div key={label} className="rounded-2xl bg-white p-3.5 shadow-soft">
              <div className="text-[10px] text-ink-400">{label}</div>
              <div className="num mt-1 text-[20px] font-semibold text-ink-900">
                {i === 0 ? screen?.districtRanking?.[0]?.count ?? '—' : `${screen?.metrics.avgResponseHours ?? '—'}h`}
              </div>
              <div className="mt-1 flex items-center gap-1 text-[9px] text-teal-600">
                <TrendingUp className="h-3 w-3" /> 全城口径
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-center">
          <DemoTag />
        </div>
      </div>
    </div>
  );
}
