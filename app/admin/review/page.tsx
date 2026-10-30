'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Inbox,
  Loader2,
  Sparkles,
  UserRound
} from 'lucide-react';
import { EvidencePhoto } from '@/components/EvidencePhoto';
import { ConfidenceBar, Empty, StatusBadge, SeverityBadge, TypeBadge, DemoTag } from '@/components/ui/kit';
import { toast } from '@/components/ui/toast';
import { apiGet, apiPost } from '@/lib/client';
import type { AssignmentState, EvidenceBox, Ticket, TicketDetail } from '@/domain/types';
import { ASSIGNMENT_SOURCE_META, DEPARTMENTS } from '@/domain/constants';
import { fmtDateTime, fmtRelative } from '@/lib/format';
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

interface QueueResp {
  rows: AdminRow[];
  total: number;
}

interface DetailResp {
  detail: TicketDetail;
  creator: string;
}

interface EditState {
  department: string;
  assignee: string;
  deadline: string;
}

interface ConfirmChange {
  assignmentId: string;
  department?: string;
  assignee?: string;
  deadline?: string;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TABS: { key: 'confirm' | 'reassign' | 'reject'; label: string }[] = [
  { key: 'confirm', label: '确认方案' },
  { key: 'reassign', label: '改派' },
  { key: 'reject', label: '驳回' }
];

export default function ReviewPage() {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [total, setTotal] = useState(0);
  const [queueLoading, setQueueLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab] = useState<'confirm' | 'reassign' | 'reject'>('confirm');
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [reassignDept, setReassignDept] = useState<string>(DEPARTMENTS[0]);
  const [reassignNote, setReassignNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadQueue(nextSelected?: string | null) {
    setQueueLoading(true);
    try {
      const d = await apiGet<QueueResp>('/api/admin/tickets?status=pending_review&pageSize=50');
      setRows(d.rows);
      setTotal(d.total);
      setSelectedId((cur) => {
        if (nextSelected === null) return d.rows[0]?.ticket.id ?? null;
        if (nextSelected && d.rows.some((r) => r.ticket.id === nextSelected)) return nextSelected;
        if (cur && d.rows.some((r) => r.ticket.id === cur)) return cur;
        return d.rows[0]?.ticket.id ?? null;
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : '复核队列加载失败', 'error');
      setRows([]);
      setTotal(0);
    } finally {
      setQueueLoading(false);
    }
  }

  useEffect(() => {
    void loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let alive = true;
    setDetailLoading(true);
    apiGet<DetailResp>(`/api/tickets/${encodeURIComponent(selectedId)}`)
      .then((d) => {
        if (alive) setDetail(d.detail);
      })
      .catch((err) => {
        if (alive) toast(err instanceof Error ? err.message : '工单详情加载失败', 'error');
      })
      .finally(() => {
        if (alive) setDetailLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!detail) return;
    const next: Record<string, EditState> = {};
    for (const a of detail.assignments.filter((x) => x.state === 'proposed')) {
      next[a.id] = { department: a.department, assignee: a.assignee, deadline: toLocalInput(a.deadline) };
    }
    setEdits(next);
    setReassignDept(detail.assignments.find((a) => a.state === 'proposed' || a.state === 'active')?.department ?? DEPARTMENTS[0]);
    setReassignNote('');
    setRejectReason('');
    setTab('confirm');
  }, [detail]);

  const proposed = useMemo(() => detail?.assignments.filter((a) => a.state === 'proposed') ?? [], [detail]);

  const boxes = useMemo<EvidenceBox[]>(() => {
    if (!detail) return [];
    const all = detail.findings.flatMap((f) => f.evidence ?? []);
    const seen = new Set<string>();
    return all.filter((b) => {
      const key = `${b.x}-${b.y}-${b.w}-${b.h}-${b.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [detail]);

  const reasonText = useMemo(() => {
    const run = detail?.runs.find((r) => r.stage === 'classify');
    const reason = run?.outputJson?.reason;
    return typeof reason === 'string' ? reason : '';
  }, [detail]);

  function updateEdit(id: string, patch: Partial<EditState>) {
    setEdits((prev) => {
      const base: EditState = prev[id] ?? { department: '', assignee: '', deadline: '' };
      return { ...prev, [id]: { ...base, ...patch } };
    });
  }

  async function afterAction(message: string) {
    toast(message, 'success');
    await loadQueue(null);
  }

  async function doConfirm() {
    if (!detail || submitting) return;
    setSubmitting(true);
    try {
      const changes: ConfirmChange[] = [];
      for (const a of proposed) {
        const e = edits[a.id];
        const item: ConfirmChange = { assignmentId: a.id };
        if (e?.department) item.department = e.department;
        if (e?.assignee.trim()) item.assignee = e.assignee.trim();
        if (e?.deadline) {
          const ts = new Date(e.deadline);
          if (!Number.isNaN(ts.getTime())) item.deadline = ts.toISOString();
        }
        changes.push(item);
      }
      await apiPost<{ detail: TicketDetail }>(`/api/admin/tickets/${detail.id}/confirm`, { changes });
      await afterAction('复核通过，分派方案已下发');
    } catch (err) {
      toast(err instanceof Error ? err.message : '确认失败', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function doReassign() {
    if (!detail || submitting) return;
    if (!reassignDept) return toast('请选择承办部门', 'error');
    setSubmitting(true);
    try {
      await apiPost<{ detail: TicketDetail }>(`/api/admin/tickets/${detail.id}/reassign`, {
        department: reassignDept,
        note: reassignNote.trim()
      });
      await afterAction(`已改派至${reassignDept}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : '改派失败', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function doReject() {
    if (!detail || submitting) return;
    if (!rejectReason.trim()) return toast('驳回理由为必填项', 'error');
    setSubmitting(true);
    try {
      await apiPost<{ detail: TicketDetail }>(`/api/admin/tickets/${detail.id}/reject`, { reason: rejectReason.trim() });
      await afterAction('已驳回该分派方案');
    } catch (err) {
      toast(err instanceof Error ? err.message : '驳回失败', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="h2 flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-brand-500" /> 人工复核台
          </div>
          <div className="mt-1 text-[12px] text-ink-400">
            低置信或降级工单由坐席研判；确认后分派方案正式下发承办部门。
          </div>
        </div>
        <Link href="/admin/tickets" className="btn-ghost px-3 py-2 text-[12px]">
          <ArrowLeft className="h-3.5 w-3.5" /> 全部工单
        </Link>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[302px_minmax(0,1fr)]">
        <div className="card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-800">
              <Inbox className="h-4 w-4 text-amber-500" /> 待复核队列
            </div>
            <span className="num rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{total}</span>
          </div>

          {queueLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[92px] animate-pulse rounded-xl bg-ink-100/70" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <Empty title="队列已清空" desc="当前没有等待人工复核的工单。" />
          ) : (
            <div className="scroll-thin max-h-[560px] space-y-1.5 overflow-y-auto p-2.5">
              {rows.map((row) => {
                const active = row.ticket.id === selectedId;
                return (
                  <button
                    key={row.ticket.id}
                    onClick={() => setSelectedId(row.ticket.id)}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition',
                      active
                        ? 'border-brand-300 bg-brand-50/70 shadow-soft'
                        : 'border-ink-200/70 bg-white hover:border-brand-200 hover:bg-brand-50/30'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="num text-[10px] text-ink-400">{row.ticket.code}</span>
                      {row.overdue ? (
                        <span className="rounded-full bg-danger-50 px-1.5 py-0.5 text-[9px] font-medium text-danger-600">超时</span>
                      ) : (
                        <span className="text-[9px] text-ink-300">{fmtRelative(row.ticket.createdAt)}</span>
                      )}
                    </div>
                    <div className="mt-1.5 line-clamp-2 text-[12px] font-medium leading-relaxed text-ink-800">{row.ticket.title}</div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <TypeBadge type={row.ticket.type} size="sm" />
                      {row.ticket.needsReview ? (
                        <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] text-amber-700">需复核</span>
                      ) : null}
                    </div>
                    <div className="mt-2">
                      <ConfidenceBar value={row.ticket.confidence} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {detailLoading ? (
            <div className="space-y-4">
              <div className="h-[110px] animate-pulse rounded-2xl bg-white/70" />
              <div className="h-[300px] animate-pulse rounded-2xl bg-white/70" />
              <div className="h-[240px] animate-pulse rounded-2xl bg-white/70" />
            </div>
          ) : !detail ? (
            <div className="card">
              <Empty title="请选择一张待复核工单" desc="从左侧队列中选择，或等待新的低置信工单进入。" />
            </div>
          ) : (
            <>
              <div className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="num text-[10px] text-ink-400">{detail.code}</div>
                    <div className="mt-1 text-[18px] font-semibold leading-snug text-ink-900">{detail.title}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <TypeBadge type={detail.type} size="sm" />
                      <SeverityBadge severity={detail.severity} size="sm" />
                      {detail.degraded ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">AI 降级</span>
                      ) : null}
                      {detail.needsReview ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">需复核</span>
                      ) : null}
                    </div>
                  </div>
                  <StatusBadge status={detail.status} />
                </div>

                <div className="mt-4 grid gap-3 rounded-xl bg-ink-50 p-3 sm:grid-cols-3">
                  <div>
                    <div className="text-[10px] text-ink-400">判定置信度</div>
                    <div className="mt-1">
                      <ConfidenceBar value={detail.confidence} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-ink-400">已等待</div>
                    <div className="mt-1 flex items-center gap-1 text-[12px] font-medium text-ink-700">
                      <Clock3 className="h-3.5 w-3.5 text-amber-500" /> {fmtRelative(detail.createdAt)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-ink-400">上报时间</div>
                    <div className="num mt-1 text-[12px] text-ink-700">{fmtDateTime(detail.createdAt)}</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                  {detail.images[0] ? (
                    <EvidencePhoto
                      src={detail.images[0].url}
                      alt="市民上传的现场照片"
                      boxes={boxes}
                      className="aspect-[4/3] w-full"
                    />
                  ) : (
                    <div className="grid aspect-[4/3] place-items-center rounded-2xl border border-dashed border-ink-200 text-[12px] text-ink-400">
                      无现场照片
                    </div>
                  )}

                  <div className="card p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-800">
                        <Sparkles className="h-4 w-4 text-brand-500" /> AI 识别结论
                      </div>
                      <span className="num text-[10px] text-ink-400">
                        {detail.runs.find((r) => r.stage === 'classify')?.model ?? 'qwen-vl-max (mock)'}
                      </span>
                    </div>

                    {reasonText ? (
                      <div className="mt-2 rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
                        判定依据：{reasonText}
                      </div>
                    ) : null}

                    <div className="mt-3 space-y-2">
                      {detail.findings.map((f, i) => (
                        <div key={f.id} className="rounded-xl bg-ink-50 p-3">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-800">
                              <span className="num text-[9px] text-ink-400">#{i + 1}</span>
                              <TypeBadge type={f.type} size="sm" />
                            </span>
                            <span className="num text-[10px] text-ink-400">{Math.round(f.confidence * 100)}%</span>
                          </div>
                          <div className="mt-1.5 text-[11px] leading-relaxed text-ink-600">{f.desc || '无补充描述'}</div>
                        </div>
                      ))}
                    </div>

                    {detail.description ? (
                      <div className="mt-3 border-t border-ink-100 pt-3">
                        <div className="text-[10px] text-ink-400">市民现场描述</div>
                        <div className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-ink-600">{detail.description}</div>
                      </div>
                    ) : null}
                  </div>

                  {detail.guide.length ? (
                    <div className="rounded-2xl border border-teal-200/70 bg-teal-50/50 p-4">
                      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-teal-800">
                        <CheckCircle2 className="h-3.5 w-3.5" /> 知识库依据（RAG 引用）
                      </div>
                      <div className="mt-2.5 space-y-2">
                        {detail.guide.slice(0, 3).map((g) => (
                          <div key={`${g.docTitle}-${g.clause}`} className="rounded-xl bg-white/80 p-2.5">
                            <div className="text-[9px] text-ink-400">
                              《{g.docTitle.replace(/《|》/g, '')}》 {g.clause}
                            </div>
                            <div className="mt-1 text-[10px] leading-relaxed text-ink-600">{g.content}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <div className="card p-4">
                    <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-800">
                      <Building2 className="h-4 w-4 text-teal-600" /> Agent 提议分派
                    </div>

                    {proposed.length === 0 ? (
                      <div className="mt-3 rounded-xl border border-dashed border-ink-200 py-5 text-center text-[11px] text-ink-400">
                        该工单没有待确认的分派方案，确认后可直接转已分派。
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2.5">
                        {proposed.map((a) => (
                          <div key={a.id} className="rounded-xl border border-ink-200/70 bg-white p-3">
                            <div className="flex items-center justify-between">
                              <span
                                className="chip px-2 py-0.5 text-[10px]"
                                style={{
                                  background: ASSIGNMENT_SOURCE_META[a.source].soft,
                                  color: ASSIGNMENT_SOURCE_META[a.source].color
                                }}
                              >
                                {ASSIGNMENT_SOURCE_META[a.source].label}
                              </span>
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">待确认</span>
                            </div>
                            <div className="mt-2.5 space-y-1.5 text-[11px]">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-ink-400">承办部门</span>
                                <span className="font-medium text-ink-800">{a.department}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-ink-400">承办人</span>
                                <span className="flex items-center gap-1 text-ink-700">
                                  <UserRound className="h-3 w-3" /> {a.assignee}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-ink-400">承诺时限</span>
                                <span className="num text-ink-700">{fmtDateTime(a.deadline)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-ink-400">派单回执</span>
                                <span className="num text-[10px] text-ink-500">{a.receiptNo ?? '确认后生成'}</span>
                              </div>
                            </div>
                            <div className="mt-2 rounded-lg bg-ink-50 p-2 text-[10px] leading-relaxed text-ink-500">{a.reason}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card sticky top-20 overflow-hidden">
                    <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-800">
                        <ClipboardCheck className="h-4 w-4 text-brand-500" /> 复核操作
                      </div>
                      <div className="flex rounded-lg bg-ink-100 p-0.5">
                        {TABS.map((t) => (
                          <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={cn(
                              'rounded-md px-2.5 py-1 text-[11px] transition',
                              tab === t.key ? 'bg-white font-medium text-brand-700 shadow-sm' : 'text-ink-500'
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-3.5">
                      {tab === 'confirm' ? (
                        <div className="space-y-3">
                          {proposed.length === 0 ? (
                            <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-700">
                              当前没有待确认的分派方案，确认后工单将直接转为「已分派」，请谨慎操作。
                            </div>
                          ) : (
                            proposed.map((a, i) => {
                              const e = edits[a.id] ?? { department: a.department, assignee: a.assignee, deadline: toLocalInput(a.deadline) };
                              return (
                                <div key={a.id} className="rounded-xl border border-ink-200/70 p-3">
                                  <div className="text-[10px] text-ink-400">
                                    待确认分派 #{i + 1} · 可调整部门、承办人与时限
                                  </div>
                                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                    <label className="block">
                                      <span className="text-[10px] text-ink-400">承办部门</span>
                                      <select
                                        className="field mt-1 px-2.5 py-2 text-[12px]"
                                        value={e.department}
                                        onChange={(ev) => updateEdit(a.id, { department: ev.target.value })}
                                      >
                                        {DEPARTMENTS.map((d) => (
                                          <option key={d} value={d}>
                                            {d}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="block">
                                      <span className="text-[10px] text-ink-400">承办人</span>
                                      <input
                                        className="field mt-1 px-2.5 py-2 text-[12px]"
                                        value={e.assignee}
                                        onChange={(ev) => updateEdit(a.id, { assignee: ev.target.value })}
                                        placeholder="承办人姓名"
                                      />
                                    </label>
                                    <label className="block sm:col-span-2">
                                      <span className="text-[10px] text-ink-400">承诺时限</span>
                                      <input
                                        type="datetime-local"
                                        className="field mt-1 px-2.5 py-2 text-[12px]"
                                        value={e.deadline}
                                        onChange={(ev) => updateEdit(a.id, { deadline: ev.target.value })}
                                      />
                                    </label>
                                  </div>
                                </div>
                              );
                            })
                          )}
                          <button onClick={doConfirm} disabled={submitting} className="btn-primary w-full py-2.5 text-[13px]">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            确认并下发
                          </button>
                        </div>
                      ) : tab === 'reassign' ? (
                        <div className="space-y-3">
                          <label className="block">
                            <span className="text-[10px] text-ink-400">改派至承办部门</span>
                            <select
                              className="field mt-1 px-2.5 py-2 text-[12px]"
                              value={reassignDept}
                              onChange={(ev) => setReassignDept(ev.target.value)}
                            >
                              {DEPARTMENTS.map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-[10px] text-ink-400">改派备注</span>
                            <textarea
                              value={reassignNote}
                              onChange={(ev) => setReassignNote(ev.target.value.slice(0, 120))}
                              rows={3}
                              placeholder="说明改派理由，例如职责边界判定错误"
                              className="field mt-1 resize-none text-[12px]"
                            />
                          </label>
                          <button onClick={doReassign} disabled={submitting} className="btn-soft w-full py-2.5 text-[13px]">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                            提交改派
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <label className="block">
                            <span className="flex items-center gap-1 text-[10px] text-ink-400">
                              驳回理由 <span className="text-danger-500">*</span>
                            </span>
                            <textarea
                              value={rejectReason}
                              onChange={(ev) => setRejectReason(ev.target.value.slice(0, 200))}
                              rows={4}
                              placeholder="必填，将写入工单审计轨迹"
                              className="field mt-1 resize-none text-[12px]"
                            />
                          </label>
                          <div className="flex items-start gap-1.5 rounded-xl bg-danger-50 px-3 py-2 text-[10px] leading-relaxed text-danger-700">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            驳回后方案作废，工单回到分派前状态，需重新运行 Agent 或人工分派。
                          </div>
                          <button onClick={doReject} disabled={submitting} className="btn-danger w-full py-2.5 text-[13px]">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                            确认驳回
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-1">
                <DemoTag />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
