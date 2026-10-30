'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlarmClock,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  FileText,
  Sparkles,
  Star,
  Timer,
  TrendingUp
} from 'lucide-react';
import { EChart, donutOption, lineOption } from '@/components/EChart';
import { ConfidenceBar, Empty, SectionTitle, Stat, TypeBadge } from '@/components/ui/kit';
import { toast } from '@/components/ui/toast';
import { apiGet } from '@/lib/client';
import type { AssignmentState, OverdueRow, StatsOverview, Ticket } from '@/domain/types';
import { TYPE_META } from '@/domain/constants';
import { fmtDateTime, fmtHours } from '@/lib/format';
import { cn, pct } from '@/lib/utils';

interface AdminRow {
  ticket: Ticket;
  department: string;
  assignmentState: AssignmentState | 'none';
  assignee: string;
  deadline: string | null;
  overdue: boolean;
  findings: number;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-white/70', className)} />;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [reviewRows, setReviewRows] = useState<AdminRow[]>([]);
  const [overdueRows, setOverdueRows] = useState<OverdueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const [s, r, o] = await Promise.all([
          apiGet<StatsOverview>('/api/admin/stats'),
          apiGet<{ rows: AdminRow[]; total: number }>('/api/admin/tickets?status=pending_review&pageSize=5'),
          apiGet<{ rows: OverdueRow[]; total: number; severe: number }>('/api/admin/overdue')
        ]);
        if (!alive) return;
        setStats(s);
        setReviewRows(r.rows);
        setOverdueRows(o.rows.slice(0, 5));
      } catch (err) {
        if (alive) toast(err instanceof Error ? err.message : '工作台数据加载失败', 'error');
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  const trendOption = useMemo(() => lineOption(stats?.trend ?? []), [stats]);
  const typeOption = useMemo(
    () =>
      donutOption(
        (stats?.typeDistribution ?? []).map((d) => ({
          label: d.label,
          count: d.count,
          color: TYPE_META[d.type].color
        }))
      ),
    [stats]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[112px]" />
          ))}
        </div>
        <Skeleton className="h-[300px]" />
        <div className="grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-[260px]" />
          <Skeleton className="h-[260px]" />
          <Skeleton className="h-[260px]" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="card">
        <Empty title="统计数据暂不可用" desc="请检查登录状态或稍后刷新页面重试。" />
      </div>
    );
  }

  const districtMax = Math.max(1, ...stats.districtRanking.map((d) => d.count));

  return (
    <div className="space-y-4">
      <SectionTitle
        title="运营总览"
        desc="实时汇总上报、立案、复核与办结数据，数据来自演示内存库。"
        action={
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px] text-ink-500 shadow-soft">
            <TrendingUp className="h-3.5 w-3.5 text-brand-500" />
            累计 {stats.totalTickets} 张工单
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Stat label="今日上报" value={stats.todayReports} unit="件" tone="brand" icon={<FileText className="h-3.5 w-3.5" />} hint={`累计 ${stats.totalTickets} 张工单`} />
        <Stat label="AI 自动立案率" value={pct(stats.aiAutoFileRate)} tone="teal" icon={<Sparkles className="h-3.5 w-3.5" />} hint="置信度 ≥ 75% 且未降级" />
        <Stat label="平均响应" value={fmtHours(stats.avgResponseHours)} tone="ink" icon={<Timer className="h-3.5 w-3.5" />} hint="从上报到部门接单" />
        <Stat label="办结率" value={pct(stats.completionRate)} tone="teal" icon={<CheckCircle2 className="h-3.5 w-3.5" />} hint="已办结 / 全部工单" />
        <Stat label="满意度" value={pct(stats.satisfactionRate)} tone="amber" icon={<Star className="h-3.5 w-3.5" />} hint="基于已评价工单" />
        <Stat label="待复核" value={stats.pendingReview} unit="件" tone="danger" icon={<ClipboardCheck className="h-3.5 w-3.5" />} hint={`超时工单 ${stats.overdue} 件`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="card p-4 xl:col-span-2">
          <SectionTitle title="14 天上报与办结趋势" desc="折线为每日新增上报与办结数量" />
          <div className="mt-2">
            <EChart option={trendOption} height={218} />
          </div>
        </div>

        <div className="card relative overflow-hidden p-4">
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-brand-50" />
          <div className="relative">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-500">
              <Cpu className="h-3.5 w-3.5 text-brand-500" /> AI 采纳率
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="num text-[34px] font-semibold leading-none text-brand-700">{pct(stats.adoption.rate)}</span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-200">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-700"
                style={{ width: `${Math.max(2, Math.round(stats.adoption.rate * 100))}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-ink-400">
              <span>AI 建议被坐席采纳</span>
              <span className="num text-ink-500">
                {stats.adoption.numerator} / {stats.adoption.denominator}
              </span>
            </div>
            <div className="mt-3 rounded-xl bg-ink-50 p-2.5 text-[10px] leading-relaxed text-ink-500">
              Agent 分派方案被复核确认且未被改派即计为一次采纳；改派 / 驳回计入分母。
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="card p-4">
          <SectionTitle title="问题类型分布" desc="按 T01–T07 统计" />
          <div className="mt-1">
            <EChart option={typeOption} height={210} />
          </div>
        </div>

        <div className="card p-4">
          <SectionTitle title="区域排名" desc="工单量与平均响应" />
          <div className="mt-3 space-y-3">
            {stats.districtRanking.length === 0 ? (
              <div className="py-10 text-center text-[12px] text-ink-400">暂无区域数据</div>
            ) : (
              stats.districtRanking.map((d, i) => (
                <div key={d.district}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-1.5 font-medium text-ink-700">
                      <span className="num grid h-4 w-4 place-items-center rounded bg-brand-50 text-[9px] text-brand-600">{i + 1}</span>
                      {d.district}
                    </span>
                    <span className="num text-[11px] text-ink-400">
                      {d.count} 件 · 响应 {fmtHours(d.avgResponseHours)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                      style={{ width: `${Math.max(6, (d.count / districtMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card p-4">
          <SectionTitle title="AI 链路健康" desc="模型、检索与工具状态" action={<Cpu className="h-4 w-4 text-ink-300" />} />
          <div className="mt-3 space-y-2">
            {[
              { name: 'VLM 视觉识别', meta: 'qwen-vl-max · mock', tone: 'teal' },
              { name: 'RAG 知识检索', meta: '命中阈值 0.2 · TopK 3', tone: 'brand' },
              { name: 'Agent 编排', meta: `${8} 步上限 · 5 阶段`, tone: 'brand' },
              { name: 'MCP 工具', meta: '4 个工具 · stdio', tone: 'teal' }
            ].map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2.5">
                <div>
                  <div className="text-[12px] font-medium text-ink-700">{item.name}</div>
                  <div className="mt-0.5 text-[10px] text-ink-400">{item.meta}</div>
                </div>
                <span className={cn('h-1.5 w-1.5 rounded-full', item.tone === 'teal' ? 'bg-teal-500' : 'bg-brand-500')} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Link href="/admin/ai" className="btn-soft flex-1 py-2 text-[12px]">
              能力中心 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link href="/admin/audit" className="btn-ghost flex-1 py-2 text-[12px]">
              调用审计
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="flex items-end justify-between gap-3 border-b border-ink-100 px-4 py-3.5">
            <div>
              <div className="flex items-center gap-1.5 text-[14px] font-semibold text-ink-800">
                <ClipboardCheck className="h-4 w-4 text-amber-500" /> 待复核快捷列表
              </div>
              <div className="mt-0.5 text-[11px] text-ink-400">低置信或降级工单，需坐席研判分派方案</div>
            </div>
            <Link href="/admin/review" className="shrink-0 text-[11px] text-brand-600 hover:underline">
              去复核台 →
            </Link>
          </div>
          {reviewRows.length === 0 ? (
            <Empty title="没有待复核工单" desc="AI 立案置信度充足，全部方案已自动下发。" />
          ) : (
            <div className="divide-y divide-ink-100">
              {reviewRows.map((row) => (
                <Link key={row.ticket.id} href="/admin/review" className="block px-4 py-3 transition hover:bg-brand-50/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="num text-[10px] text-ink-400">{row.ticket.code}</span>
                    <span className="flex items-center gap-1.5">
                      {row.ticket.degraded ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">降级</span>
                      ) : null}
                      {row.overdue ? <span className="rounded-full bg-danger-50 px-2 py-0.5 text-[10px] text-danger-600">超时</span> : null}
                      <span className="text-[10px] text-ink-300">{fmtDateTime(row.ticket.createdAt)}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 truncate text-[13px] font-medium text-ink-800">{row.ticket.title}</div>
                  <div className="mt-2 flex items-center gap-3">
                    <TypeBadge type={row.ticket.type} size="sm" />
                    <div className="w-28">
                      <ConfidenceBar value={row.ticket.confidence} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-end justify-between gap-3 border-b border-ink-100 px-4 py-3.5">
            <div>
              <div className="flex items-center gap-1.5 text-[14px] font-semibold text-ink-800">
                <AlarmClock className="h-4 w-4 text-danger-500" /> 超时预警 Top 5
              </div>
              <div className="mt-0.5 text-[11px] text-ink-400">已超过承诺时限且尚未办结的生效分派</div>
            </div>
            <Link href="/admin/overdue" className="shrink-0 text-[11px] text-brand-600 hover:underline">
              督办中心 →
            </Link>
          </div>
          {overdueRows.length === 0 ? (
            <Empty title="暂无超时工单" desc="所有生效分派均在承诺时限内推进。" />
          ) : (
            <div className="divide-y divide-ink-100">
              {overdueRows.map((row) => (
                <Link key={row.code} href="/admin/overdue" className="block px-4 py-3 transition hover:bg-danger-50/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="num text-[10px] text-ink-400">{row.code}</span>
                    <span className="num rounded-full bg-danger-50 px-2 py-0.5 text-[10px] font-semibold text-danger-600">
                      超时 {fmtHours(row.overdueHours)}
                    </span>
                  </div>
                  <div className="mt-1.5 truncate text-[13px] font-medium text-ink-800">{row.title}</div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-ink-400">
                    <span>
                      {row.department} · {row.assignee}
                    </span>
                    <span>承诺 {fmtDateTime(row.deadline)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
