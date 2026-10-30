'use client';

import { useEffect, useState } from 'react';
import { AlarmClock, AlertTriangle, BellRing, Copy, Loader2, Timer, X } from 'lucide-react';
import { Empty, SeverityBadge, Stat, StatusBadge } from '@/components/ui/kit';
import { toast } from '@/components/ui/toast';
import { apiGet, apiPost } from '@/lib/client';
import type { OverdueRow, TicketDetail } from '@/domain/types';
import { fmtDateTime, fmtHours } from '@/lib/format';
import { cn } from '@/lib/utils';

interface OverdueResp {
  rows: OverdueRow[];
  total: number;
  severe: number;
}

interface UrgeResult {
  draft: string;
  runId: string;
  overdueHours: number;
  department: string;
  notification: unknown;
  note: string | null;
}

interface DrawerState {
  row: OverdueRow;
  res: UrgeResult;
}

export default function OverduePage() {
  const [rows, setRows] = useState<OverdueRow[]>([]);
  const [total, setTotal] = useState(0);
  const [severe, setSevere] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingCode, setLoadingCode] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<OverdueResp>('/api/admin/overdue')
      .then((d) => {
        if (!alive) return;
        setRows(d.rows);
        setTotal(d.total);
        setSevere(d.severe);
      })
      .catch((err) => {
        if (!alive) return;
        toast(err instanceof Error ? err.message : '督办数据加载失败', 'error');
        setRows([]);
        setTotal(0);
        setSevere(0);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function urgeRow(row: OverdueRow) {
    if (loadingCode) return;
    setLoadingCode(row.code);
    try {
      const d = await apiGet<{ detail: TicketDetail; creator: string }>(`/api/tickets/${encodeURIComponent(row.code)}`);
      const res = await apiPost<UrgeResult>(`/api/admin/tickets/${d.detail.id}/urge`, { note: '' });
      setDrawer({ row, res });
      toast('AI 催办草稿已生成', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '生成催办失败', 'error');
    } finally {
      setLoadingCode(null);
    }
  }

  async function copyDraft() {
    if (!drawer) return;
    try {
      await navigator.clipboard.writeText(drawer.res.draft);
      toast('催办文本已复制', 'success');
    } catch {
      toast('复制失败，请手动选择文本', 'error');
    }
  }

  const maxHours = rows.length ? Math.max(...rows.map((r) => r.overdueHours)) : 0;

  return (
    <div className="space-y-4">
      <div>
        <div className="h2 flex items-center gap-2">
          <AlarmClock className="h-5 w-5 text-danger-500" /> 督办中心
        </div>
        <div className="mt-1 text-[12px] text-ink-400">
          监测超过承诺时限且未办结的生效分派，一键生成 AI 催办公文并留痕。
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="超时工单" value={total} unit="件" tone="danger" icon={<AlarmClock className="h-3.5 w-3.5" />} hint="存在生效分派且已超时" />
        <Stat label="严重超时（> 2 小时）" value={severe} unit="件" tone="amber" icon={<AlertTriangle className="h-3.5 w-3.5" />} hint="建议优先督办" />
        <Stat label="最长超时" value={fmtHours(maxHours)} tone="ink" icon={<Timer className="h-3.5 w-3.5" />} hint={rows[0] ? `${rows[0].department} · ${rows[0].code}` : '暂无超时'} />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3.5">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-800">
            <BellRing className="h-4 w-4 text-danger-500" /> 超时清单
          </div>
          <span className="num rounded-full bg-danger-50 px-2 py-0.5 text-[10px] font-semibold text-danger-600">{total} 条</span>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-ink-100/70" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty title="暂无超时工单" desc="所有生效分派均在承诺时限内推进，继续保持。" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="bg-ink-50 text-[11px] font-medium text-ink-500">
                  <th className="whitespace-nowrap px-4 py-2.5">编号</th>
                  <th className="px-3 py-2.5">标题</th>
                  <th className="whitespace-nowrap px-3 py-2.5">承办部门</th>
                  <th className="whitespace-nowrap px-3 py-2.5">承办人</th>
                  <th className="whitespace-nowrap px-3 py-2.5">承诺时限</th>
                  <th className="whitespace-nowrap px-3 py-2.5">超时</th>
                  <th className="whitespace-nowrap px-3 py-2.5">严重度</th>
                  <th className="whitespace-nowrap px-3 py-2.5">状态</th>
                  <th className="whitespace-nowrap px-4 py-2.5">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 text-[12px]">
                {rows.map((row) => (
                  <tr key={`${row.code}-${row.department}`} className="transition odd:bg-ink-50/40 hover:bg-danger-50/30">
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="num text-[11px] text-ink-500">{row.code}</span>
                    </td>
                    <td className="max-w-[260px] px-3 py-3">
                      <div className="truncate font-medium text-ink-800">{row.title}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-600">{row.department}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-600">{row.assignee}</td>
                    <td className="num whitespace-nowrap px-3 py-3 text-[11px] text-ink-600">{fmtDateTime(row.deadline)}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span
                        className={cn(
                          'num rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          row.overdueHours > 2 ? 'bg-danger-50 text-danger-600' : 'bg-amber-50 text-amber-700'
                        )}
                      >
                        {fmtHours(row.overdueHours)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <SeverityBadge severity={row.severity} size="sm" />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <StatusBadge status={row.status} size="sm" />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        onClick={() => urgeRow(row)}
                        disabled={loadingCode !== null}
                        className="btn-soft px-2.5 py-1.5 text-[11px]"
                      >
                        {loadingCode === row.code ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <BellRing className="h-3 w-3" />
                        )}
                        生成催办
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {drawer ? (
        <>
          <button
            className="fixed inset-0 z-40 bg-ink-900/25 backdrop-blur-sm"
            onClick={() => setDrawer(null)}
            aria-label="关闭抽屉"
          />
          <aside className="animate-rise fixed inset-y-0 right-0 z-50 flex w-full max-w-[430px] flex-col bg-white shadow-float">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
              <div>
                <div className="text-[15px] font-semibold text-ink-900">AI 催办草稿</div>
                <div className="num mt-0.5 text-[10px] text-ink-400">{drawer.row.code}</div>
              </div>
              <button
                onClick={() => setDrawer(null)}
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-ink-50 p-3">
                <div>
                  <div className="text-[10px] text-ink-400">承办部门</div>
                  <div className="mt-1 text-[12px] font-medium text-ink-800">{drawer.res.department}</div>
                </div>
                <div>
                  <div className="text-[10px] text-ink-400">超时时长</div>
                  <div className="mt-1 text-[12px] font-semibold text-danger-600">{fmtHours(drawer.res.overdueHours)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-ink-400">原承诺时限</div>
                  <div className="num mt-1 text-[11px] text-ink-700">{fmtDateTime(drawer.row.deadline)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-ink-400">催办运行 ID</div>
                  <div className="num mt-1 truncate text-[10px] text-ink-500">{drawer.res.runId}</div>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-ink-500">催办正文</div>
                <pre className="mt-1.5 whitespace-pre-wrap rounded-xl border border-ink-200/70 bg-white p-3 text-[12px] leading-relaxed text-ink-700">
                  {drawer.res.draft}
                </pre>
              </div>

              <div className="rounded-xl bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-700">
                催办记录已写入工单审计轨迹，AI 运行详情可在审计中心按 urge 阶段查询。
              </div>
            </div>

            <div className="flex gap-2 border-t border-ink-100 p-4">
              <button onClick={copyDraft} className="btn-ghost flex-1 py-2.5 text-[12px]">
                <Copy className="h-3.5 w-3.5" /> 复制文本
              </button>
              <button onClick={() => setDrawer(null)} className="btn-primary flex-1 py-2.5 text-[12px]">
                完成
              </button>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
