'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { Empty, SeverityBadge, StatusBadge, TypeBadge } from '@/components/ui/kit';
import { toast } from '@/components/ui/toast';
import { apiGet } from '@/lib/client';
import type { AssignmentState, Ticket } from '@/domain/types';
import { DISTRICTS, PROBLEM_TYPES, TYPE_META } from '@/domain/constants';
import { fmtDateTime, fmtHours } from '@/lib/format';
import { cn } from '@/lib/utils';

interface AdminRow {
  ticket: Ticket;
  department: string;
  assignmentState: AssignmentState | 'none';
  assignee: string;
  deadline: string | null;
  overdue: boolean;
  findings: number;
}

interface ListResp {
  rows: AdminRow[];
  total: number;
  page: number;
  pageSize: number;
}

const STATUS_CHIPS: { key: string; label: string }[] = [
  { key: '', label: '全部' },
  { key: 'pending_review', label: '待复核' },
  { key: 'assigned', label: '已分派' },
  { key: 'processing', label: '处置中' },
  { key: 'closed', label: '已办结' },
  { key: 'rated', label: '已评价' },
  { key: 'reopened', label: '督办重办' }
];

const PAGE_SIZE = 20;

function overdueText(deadline: string): string {
  const h = Math.max(0, (Date.now() - new Date(deadline).getTime()) / 3600000);
  return fmtHours(h);
}

export default function AdminTicketsPage() {
  const router = useRouter();
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [district, setDistrict] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    setPage(1);
  }, [q, status, type, district]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    if (district) params.set('district', district);
    if (q) params.set('q', q);

    apiGet<ListResp>(`/api/admin/tickets?${params.toString()}`)
      .then((d) => {
        if (!alive) return;
        setRows(d.rows);
        setTotal(d.total);
        if (d.total > 0 && page > Math.ceil(d.total / PAGE_SIZE)) setPage(1);
      })
      .catch((err) => {
        if (!alive) return;
        toast(err instanceof Error ? err.message : '工单列表加载失败', 'error');
        setRows([]);
        setTotal(0);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [q, status, type, district, page]);

  const visibleRows = overdueOnly ? rows.filter((r) => r.overdue) : rows;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function resetFilters() {
    setQInput('');
    setQ('');
    setStatus('');
    setType('');
    setDistrict('');
    setOverdueOnly(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="h2">工单列表</div>
          <div className="mt-1 text-[12px] text-ink-400">按状态、类型、区域筛选全量工单，支持编号 / 标题 / 地址搜索。</div>
        </div>
        <div className="num rounded-xl bg-white px-3 py-2 text-[12px] text-ink-500 shadow-soft">
          共 {total} 条
          {overdueOnly ? <span className="ml-2 text-danger-600">本页超时 {visibleRows.length} 条</span> : null}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-inset ring-ink-200 focus-within:ring-brand-400">
            <Search className="h-4 w-4 shrink-0 text-ink-400" />
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="搜索工单编号、标题或地址"
              className="w-full bg-transparent text-[13px] text-ink-800 outline-none placeholder:text-ink-400"
            />
            {loading ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-500" /> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select className="field w-auto min-w-[120px] px-3 py-2 text-[12px]" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">全部类型</option>
              {PROBLEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_META[t].label}
                </option>
              ))}
            </select>
            <select
              className="field w-auto min-w-[110px] px-3 py-2 text-[12px]"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            >
              <option value="">全部区域</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <button
              onClick={() => setOverdueOnly((v) => !v)}
              aria-pressed={overdueOnly}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] transition',
                overdueOnly
                  ? 'border-danger-200 bg-danger-50 font-medium text-danger-700'
                  : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" /> 只看超时
            </button>
            {(qInput || q || status || type || district || overdueOnly) && (
              <button onClick={resetFilters} className="text-[11px] text-ink-400 hover:text-brand-600">
                清空筛选
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <SlidersHorizontal className="mr-1 h-3.5 w-3.5 text-ink-300" />
          {STATUS_CHIPS.map((s) => (
            <button
              key={s.key}
              onClick={() => setStatus(s.key)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[11px] transition',
                status === s.key ? 'bg-brand-500 font-medium text-white' : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="space-y-0 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="mb-2 h-12 animate-pulse rounded-lg bg-ink-100/70" />
            ))}
          </div>
        ) : visibleRows.length === 0 ? (
          <Empty
            title="没有符合条件的工单"
            desc={
              overdueOnly
                ? '本页没有超时工单，可切换页码或关闭「只看超时」。'
                : '试试调整筛选条件，或清空超时过滤。'
            }
            action={
              <button onClick={resetFilters} className="btn-soft mt-2 px-4 py-2 text-[12px]">
                清空筛选
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="bg-ink-50 text-[11px] font-medium text-ink-500">
                  <th className="whitespace-nowrap px-4 py-2.5">编号</th>
                  <th className="px-3 py-2.5">标题</th>
                  <th className="whitespace-nowrap px-3 py-2.5">严重度</th>
                  <th className="whitespace-nowrap px-3 py-2.5">状态</th>
                  <th className="whitespace-nowrap px-3 py-2.5">承办部门</th>
                  <th className="whitespace-nowrap px-3 py-2.5">承办人</th>
                  <th className="whitespace-nowrap px-3 py-2.5">承诺时限</th>
                  <th className="whitespace-nowrap px-4 py-2.5">创建时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 text-[12px]">
                {visibleRows.map((row) => (
                  <tr
                    key={row.ticket.id}
                    onClick={() => router.push(`/admin/tickets/${row.ticket.id}`)}
                    className="cursor-pointer transition odd:bg-ink-50/40 hover:bg-brand-50/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="num text-[11px] text-ink-500">{row.ticket.code}</span>
                    </td>
                    <td className="max-w-[280px] px-3 py-3">
                      <div className="truncate font-medium text-ink-800">{row.ticket.title}</div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <TypeBadge type={row.ticket.type} size="sm" />
                        {row.ticket.degraded ? (
                          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] text-amber-700">降级</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <SeverityBadge severity={row.ticket.severity} size="sm" />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <StatusBadge status={row.ticket.status} size="sm" />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-600">{row.department}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-600">{row.assignee}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {row.deadline ? (
                        <div>
                          <div className={cn('num text-[11px]', row.overdue ? 'text-danger-600' : 'text-ink-600')}>
                            {fmtDateTime(row.deadline)}
                          </div>
                          {row.overdue ? (
                            <div className="mt-0.5 text-[10px] font-medium text-danger-600">超时 {overdueText(row.deadline)}</div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="num text-[10px] text-ink-400">{fmtDateTime(row.ticket.createdAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-4 py-3">
            <span className="num text-[11px] text-ink-400">
              第 {page} / {totalPages} 页 · 共 {total} 条
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-ghost px-2.5 py-1.5 text-[11px]"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> 上一页
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-ghost px-2.5 py-1.5 text-[11px]"
              >
                下一页 <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
