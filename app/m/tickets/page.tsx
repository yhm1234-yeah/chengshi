'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Camera, ChevronRight, MapPin, Search } from 'lucide-react';
import { StatusBadge, TypeBadge, Empty, DemoTag } from '@/components/ui/kit';
import { apiGet } from '@/lib/client';
import type { ProblemType, TicketStatus } from '@/domain/types';
import { cn } from '@/lib/utils';
import { fmtDateTime } from '@/lib/format';

interface Row {
  id: string;
  code: string;
  title: string;
  type: ProblemType;
  status: TicketStatus;
  createdAt: string;
  address: string;
  severity: 'low' | 'medium' | 'urgent';
}

const TABS = [
  { key: 'all', label: '全部', status: '' },
  { key: 'doing', label: '办理中', status: 'submitted,ai_filed,pending_review,assigned,processing,reopened' },
  { key: 'done', label: '待评价', status: 'closed' },
  { key: 'rated', label: '已评价', status: 'rated' }
];

export default function TicketsPage() {
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const status = useMemo(() => TABS.find((t) => t.key === tab)?.status ?? '', [tab]);

  useEffect(() => {
    setLoading(true);
    const url = `/api/tickets?mine=1&pageSize=50${status ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
    apiGet<{ items: Row[] }>(url)
      .then((d) => setRows(d.items))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [status, q]);

  return (
    <div className="min-h-full pb-5">
      <div className="sticky top-0 z-20 bg-white px-5 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[20px] font-semibold text-ink-900">我的工单</div>
            <div className="mt-0.5 text-[11px] text-ink-400">每一次上报，都有回音</div>
          </div>
          <Link href="/m/report" className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand-600">
            <Camera className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl bg-ink-100 px-3 py-2">
          <Search className="h-3.5 w-3.5 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索工单编号或地址"
            className="w-full bg-transparent text-[12px] text-ink-700 outline-none placeholder:text-ink-400"
          />
        </div>

        <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-[11px] transition',
                tab === t.key ? 'bg-brand-500 font-medium text-white' : 'bg-ink-100 text-ink-500'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 px-5 pt-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[112px] animate-pulse rounded-2xl bg-white/70" />)
        ) : rows.length === 0 ? (
          <Empty
            title="暂无相关工单"
            desc="换个筛选条件，或去随手拍记录身边的问题。"
            action={
              <Link href="/m/report" className="btn-primary mt-2 px-4 py-2 text-[12px]">
                去上报
              </Link>
            }
          />
        ) : (
          rows.map((t) => (
            <Link key={t.id} href={`/m/tickets/${t.code}`} className="block rounded-2xl border border-ink-200/70 bg-white p-3.5 shadow-soft transition active:scale-[.99]">
              <div className="flex items-center justify-between">
                <span className="num text-[10px] text-ink-400">{t.code}</span>
                <StatusBadge status={t.status} size="sm" />
              </div>
              <div className="mt-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-ink-900">{t.title}</div>
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-ink-400">
                    <MapPin className="h-3 w-3" /> {t.address}
                  </div>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-300" />
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-ink-100 pt-2.5">
                <TypeBadge type={t.type} size="sm" />
                <span className="text-[10px] text-ink-300">{fmtDateTime(t.createdAt)}</span>
              </div>
            </Link>
          ))
        )}

        <div className="flex justify-center pt-3">
          <DemoTag />
        </div>
      </div>
    </div>
  );
}
