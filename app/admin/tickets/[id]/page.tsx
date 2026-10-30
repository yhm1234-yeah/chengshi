'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  AlertTriangle,
  BellRing,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  FileText,
  Loader2,
  MapPin,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  UserRound,
  X
} from 'lucide-react';
import { CityMap } from '@/components/CityMap';
import { EvidencePhoto } from '@/components/EvidencePhoto';
import {
  ConfidenceBar,
  DemoTag,
  Empty,
  SeverityBadge,
  StatusBadge,
  StatusFlow,
  TypeBadge
} from '@/components/ui/kit';
import { toast } from '@/components/ui/toast';
import { apiGet, apiPost, streamPost } from '@/lib/client';
import type {
  AgentStep,
  AssignmentState,
  DispatchSummary,
  EvidenceBox,
  HumanAction,
  TicketDetail
} from '@/domain/types';
import { ASSIGNMENT_SOURCE_META, DEPARTMENTS, THRESHOLDS, TYPE_META } from '@/domain/constants';
import { fmtDateTime, fmtHours, fmtRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

interface DetailResponse {
  detail: TicketDetail;
  creator: string;
}

interface UrgeResult {
  draft: string;
  runId: string;
  overdueHours: number;
  department: string;
  notification: unknown;
  note: string | null;
}

type ModalKind = 'confirm' | 'reassign' | 'reject' | 'close' | 'urge' | null;

const EVENT_LABEL: Record<string, { label: string; tone: string }> = {
  submit: { label: '市民提交工单', tone: '#667085' },
  ai_file: { label: 'AI 识别立案', tone: '#4C5DF0' },
  degrade_to_review: { label: '转人工复核', tone: '#F59300' },
  dispatch: { label: 'AI 生成分派方案', tone: '#4C5DF0' },
  confirm: { label: '坐席复核确认', tone: '#12A38F' },
  reject: { label: '坐席驳回方案', tone: '#F04438' },
  accept: { label: '承办部门接单', tone: '#12A38F' },
  close: { label: '承办部门办结', tone: '#12A38F' },
  urge: { label: '督办催办', tone: '#F04438' },
  reassign: { label: '人工改派', tone: '#12A38F' },
  rate_satisfied: { label: '市民满意评价', tone: '#039855' },
  rate_unsatisfied: { label: '市民不满意', tone: '#F04438' }
};

const PHASE_LABEL: Record<AgentStep['phase'], string> = {
  plan: '规划',
  act: '执行',
  observe: '观察',
  decide: '决策',
  reflect: '反思'
};

const STATE_META: Record<AssignmentState, { label: string; cls: string }> = {
  proposed: { label: '待确认', cls: 'bg-amber-50 text-amber-700' },
  active: { label: '生效中', cls: 'bg-teal-50 text-teal-700' },
  superseded: { label: '已被替换', cls: 'bg-ink-100 text-ink-500' }
};

const HUMAN_ACTION_LABEL: Record<HumanAction, string> = {
  confirm: '已确认',
  reassign: '已改派',
  reject: '已驳回',
  none: '未干预'
};

const STAGE_LABEL: Record<string, string> = {
  classify: '视觉识别',
  locate: '位置解析',
  describe: '现场描述',
  dispatch: 'Agent 分派',
  guide: '办理指引',
  chat: '市民问答',
  urge: '督办催办'
};

const MODAL_TITLE: Record<Exclude<ModalKind, null>, string> = {
  confirm: '确认分派方案',
  reassign: '改派承办部门',
  reject: '驳回分派方案',
  close: '办结工单',
  urge: 'AI 催办草稿'
};

export default function AdminTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = decodeURIComponent(params.id);

  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [expandedRuns, setExpandedRuns] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<ModalKind>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [formDept, setFormDept] = useState<string>(DEPARTMENTS[0]);
  const [formNote, setFormNote] = useState('');
  const [urge, setUrge] = useState<UrgeResult | null>(null);
  const [running, setRunning] = useState(false);
  const [streamSteps, setStreamSteps] = useState<AgentStep[]>([]);
  const [streamSummary, setStreamSummary] = useState<DispatchSummary | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<DetailResponse>(`/api/tickets/${encodeURIComponent(id)}`)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((err) => {
        if (alive) toast(err instanceof Error ? err.message : '工单加载失败', 'error');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, tick]);

  useEffect(() => {
    setExpandedRuns({});
    setModal(null);
    setStreamSteps([]);
    setStreamSummary(null);
  }, [id]);

  const detail = data?.detail;

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

  const activeAssignment = detail?.assignments.find((a) => a.state === 'active');
  const canReview = detail?.status === 'pending_review';
  const canClose = detail?.status === 'assigned' || detail?.status === 'processing';
  const canRerun = detail ? ['submitted', 'ai_filed', 'pending_review'].includes(detail.status) : false;

  function reload() {
    setTick((t) => t + 1);
  }

  function openModal(kind: Exclude<ModalKind, null>) {
    setFormNote('');
    setModal(kind);
    if (detail) {
      setFormDept(
        activeAssignment?.department ??
          detail.assignments.find((a) => a.state === 'proposed')?.department ??
          detail.assignments[0]?.department ??
          DEPARTMENTS[0]
      );
    }
  }

  async function submitModal() {
    if (!detail || modalBusy || !modal) return;
    if (modal === 'reject' && !formNote.trim()) return toast('驳回理由为必填项', 'error');
    if (modal === 'close' && !formNote.trim()) return toast('请填写处置说明', 'error');
    setModalBusy(true);
    try {
      if (modal === 'confirm') {
        await apiPost<{ detail: TicketDetail }>(`/api/admin/tickets/${detail.id}/confirm`, { changes: [] });
        toast('复核通过，分派方案已下发', 'success');
      } else if (modal === 'reassign') {
        await apiPost<{ detail: TicketDetail }>(`/api/admin/tickets/${detail.id}/reassign`, {
          department: formDept,
          note: formNote.trim()
        });
        toast(`已改派至${formDept}`, 'success');
      } else if (modal === 'reject') {
        await apiPost<{ detail: TicketDetail }>(`/api/admin/tickets/${detail.id}/reject`, { reason: formNote.trim() });
        toast('已驳回分派方案', 'success');
      } else if (modal === 'close') {
        await apiPost<{ detail: TicketDetail }>(`/api/admin/tickets/${detail.id}/close`, { note: formNote.trim() });
        toast('工单已办结', 'success');
      }
      setModal(null);
      setFormNote('');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error');
    } finally {
      setModalBusy(false);
    }
  }

  async function doUrge() {
    if (!detail || modalBusy) return;
    setModalBusy(true);
    try {
      const res = await apiPost<UrgeResult>(`/api/admin/tickets/${detail.id}/urge`, { note: '' });
      setUrge(res);
      setModal('urge');
      toast('AI 催办草稿已生成', 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : '催办失败', 'error');
    } finally {
      setModalBusy(false);
    }
  }

  async function runAgent() {
    if (!detail || running) return;
    setRunning(true);
    setStreamSteps([]);
    setStreamSummary(null);
    try {
      await streamPost(
        '/api/ai/dispatch',
        { ticketId: detail.id },
        (msg) => {
          if (msg.event === 'step') {
            const raw = msg.data.step;
            if (raw && typeof raw === 'object') setStreamSteps((prev) => [...prev, raw as AgentStep]);
          } else if (msg.event === 'result') {
            const raw = msg.data.summary;
            if (raw && typeof raw === 'object') {
              const summary = raw as DispatchSummary;
              setStreamSummary(summary);
              toast('Agent 分派完成', 'success', `${summary.department} · ${summary.findings} 个子问题`);
            }
          } else if (msg.event === 'error') {
            toast(typeof msg.data.message === 'string' ? msg.data.message : 'Agent 运行失败', 'error');
          }
        },
        () => {
          setRunning(false);
          reload();
        }
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Agent 运行失败', 'error');
      setRunning(false);
    }
  }

  async function copyDraft() {
    if (!urge) return;
    try {
      await navigator.clipboard.writeText(urge.draft);
      toast('催办草稿已复制', 'success');
    } catch {
      toast('复制失败，请手动选择文本', 'error');
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-40 animate-pulse rounded-xl bg-white/70" />
        <div className="h-[130px] animate-pulse rounded-2xl bg-white/70" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="h-[520px] animate-pulse rounded-2xl bg-white/70" />
          <div className="h-[520px] animate-pulse rounded-2xl bg-white/70" />
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="card">
        <Empty
          title="工单不存在或无权查看"
          desc="请返回工单列表重新选择。"
          action={
            <Link href="/admin/tickets" className="btn-primary mt-2 px-4 py-2 text-[12px]">
              返回工单列表
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => router.push('/admin/tickets')} className="btn-ghost px-3 py-2 text-[12px]">
          <ArrowLeft className="h-3.5 w-3.5" /> 返回工单列表
        </button>
        <div className="flex items-center gap-2 text-[11px] text-ink-400">
          <span>上报人</span>
          <span className="font-medium text-ink-600">{data?.creator ?? '市民'}</span>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="num text-[10px] text-ink-400">{detail.code}</div>
            <div className="mt-1 text-[20px] font-semibold leading-snug text-ink-900">{detail.title}</div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <TypeBadge type={detail.type} size="sm" />
              <SeverityBadge severity={detail.severity} size="sm" />
              <StatusBadge status={detail.status} />
              {detail.degraded ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">AI 降级</span>
              ) : null}
              {detail.needsReview ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">需人工复核</span>
              ) : null}
            </div>
          </div>
          <div className="min-w-[170px]">
            <div className="flex items-center justify-between text-[10px] text-ink-400">
              <span>判定置信度</span>
              <span>
                {detail.confidence >= THRESHOLDS.confidence && !detail.degraded ? '自动立案闸门内' : '低于闸门'}
              </span>
            </div>
            <div className="mt-1">
              <ConfidenceBar value={detail.confidence} />
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-ink-50 p-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-[10px] text-ink-400">创建时间</div>
              <div className="num mt-1 text-[12px] text-ink-700">{fmtDateTime(detail.createdAt)}</div>
            </div>
            <div>
              <div className="text-[10px] text-ink-400">办结时间</div>
              <div className="num mt-1 text-[12px] text-ink-700">{detail.closedAt ? fmtDateTime(detail.closedAt) : '—'}</div>
            </div>
            <div>
              <div className="text-[10px] text-ink-400">所属区域 / 网格</div>
              <div className="mt-1 text-[12px] text-ink-700">
                {detail.district} · <span className="num">{detail.gridCode}</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-ink-400">现场地址</div>
              <div className="mt-1 truncate text-[12px] text-ink-700">{detail.address}</div>
            </div>
          </div>
          <div className="mt-4">
            <StatusFlow status={detail.status} compact />
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {detail.images[0] ? (
            <EvidencePhoto
              src={detail.images[0].url}
              alt="现场证据照片"
              boxes={boxes}
              className="aspect-[16/10] w-full"
            />
          ) : null}

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-800">
                <Sparkles className="h-4 w-4 text-brand-500" /> AI 问题判定
              </div>
              <span className="num text-[10px] text-ink-400">
                {detail.runs.find((r) => r.stage === 'classify')?.model ?? 'qwen-vl-max (mock)'}
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {detail.findings.map((f, i) => (
                <div key={f.id} className="rounded-xl bg-ink-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <span className="num text-[9px] text-ink-400">#{i + 1}</span>
                      <span className="text-[11px] font-semibold text-ink-800">{TYPE_META[f.type].label}</span>
                      <SeverityBadge severity={f.severity} size="sm" />
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
                <div className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-ink-600">{detail.description}</div>
              </div>
            ) : null}
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-3.5">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-800">
                <MapPin className="h-4 w-4 text-brand-500" /> 位置与网格
              </div>
              <span className="num text-[10px] text-ink-400">
                {detail.lng.toFixed(5)}, {detail.lat.toFixed(5)}
              </span>
            </div>
            <CityMap className="mt-3 h-[230px]" points={[]} activePoint={{ lng: detail.lng, lat: detail.lat }} showLabels={false} showGrid />
            <div className="flex items-center justify-between border-t border-ink-100 px-4 py-2.5">
              <span className="truncate text-[11px] text-ink-500">{detail.address}</span>
              <span className="num shrink-0 text-[10px] text-ink-400">{detail.gridCode}</span>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-800">
                <FileText className="h-4 w-4 text-ink-400" /> AI 运行记录
              </div>
              <span className="num rounded-full bg-ink-100 px-2 py-0.5 text-[10px] text-ink-500">{detail.runs.length} 次</span>
            </div>
            <div className="mt-3 space-y-2">
              {detail.runs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-ink-200 py-6 text-center text-[11px] text-ink-400">
                  暂无 AI 运行记录
                </div>
              ) : (
                detail.runs.map((r) => (
                  <div key={r.id} className="rounded-xl border border-ink-200/70">
                    <button
                      onClick={() => setExpandedRuns((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                    >
                      <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600">
                        {STAGE_LABEL[r.stage] ?? r.stage}
                      </span>
                      <span className="num truncate text-[10px] text-ink-500">{r.model}</span>
                      <span className="num ml-auto shrink-0 text-[10px] text-ink-400">{r.latencyMs}ms</span>
                      {r.degraded ? (
                        <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] text-amber-700">降级</span>
                      ) : null}
                      <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-ink-300 transition', expandedRuns[r.id] && 'rotate-180')} />
                    </button>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink-100 px-3 py-2 text-[10px] text-ink-400">
                      <span className="num">tokens {r.tokensIn}/{r.tokensOut}</span>
                      <span>兜底 {r.fallbackUsed ? '是' : '否'}</span>
                      <span>人工 {HUMAN_ACTION_LABEL[r.humanAction]}</span>
                      <span className="num">{r.promptDigest.slice(0, 14)}</span>
                    </div>
                    {expandedRuns[r.id] ? (
                      <pre className="scroll-thin max-h-56 overflow-auto rounded-b-xl bg-ink-50 p-3 text-[10px] leading-relaxed text-ink-600">
                        {JSON.stringify(r.outputJson, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          {detail.feedback ? (
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-800">
                  <Star className="h-4 w-4 text-amber-500" /> 市民评价
                </div>
                <span
                  className={cn(
                    'chip px-2 py-0.5 text-[10px]',
                    detail.feedback.rating === 'satisfied' ? 'bg-teal-50 text-teal-700' : 'bg-danger-50 text-danger-700'
                  )}
                >
                  {detail.feedback.rating === 'satisfied' ? '满意' : '不满意'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {detail.feedback.tags.length ? (
                  detail.feedback.tags.map((t) => (
                    <span key={t} className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] text-ink-600">
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-ink-400">未选择标签</span>
                )}
              </div>
              {detail.feedback.comment ? (
                <div className="mt-2 rounded-xl bg-ink-50 p-2.5 text-[11px] leading-relaxed text-ink-600">
                  {detail.feedback.comment}
                </div>
              ) : null}
              <div className="num mt-2 text-[9px] text-ink-300">{fmtDateTime(detail.feedback.createdAt)}</div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          {(canReview || canClose || activeAssignment || canRerun) && (
            <div className="card border-brand-200/70 p-4">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-800">
                <CheckCircle2 className="h-4 w-4 text-brand-500" /> 工单操作
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {canReview ? (
                  <>
                    <button onClick={() => openModal('confirm')} className="btn-primary px-3 py-2 text-[12px]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> 确认方案
                    </button>
                    <button onClick={() => openModal('reassign')} className="btn-ghost px-3 py-2 text-[12px]">
                      <Building2 className="h-3.5 w-3.5" /> 改派
                    </button>
                    <button onClick={() => openModal('reject')} className="btn-ghost px-3 py-2 text-[12px] text-danger-600">
                      <AlertTriangle className="h-3.5 w-3.5" /> 驳回
                    </button>
                  </>
                ) : null}
                {canClose ? (
                  <button onClick={() => openModal('close')} className="btn-primary px-3 py-2 text-[12px]">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 办结工单
                  </button>
                ) : null}
                {activeAssignment ? (
                  <button onClick={doUrge} disabled={modalBusy} className="btn-ghost px-3 py-2 text-[12px]">
                    {modalBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
                    催办
                  </button>
                ) : null}
                {canRerun ? (
                  <button onClick={runAgent} disabled={running} className="btn-ghost px-3 py-2 text-[12px]">
                    <RefreshCw className={cn('h-3.5 w-3.5', running && 'animate-spin')} />
                    {running ? 'Agent 运行中…' : '重新运行 Agent'}
                  </button>
                ) : null}
              </div>
              <div className="mt-2.5 text-[10px] leading-relaxed text-ink-400">
                所有操作均写入工单审计轨迹，并记录 AI 人工干预结果（confirm / reassign / reject）。
              </div>
            </div>
          )}

          {running || streamSteps.length > 0 ? (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-800">
                  <Sparkles className="h-4 w-4 text-brand-500" /> Agent 实时过程
                </div>
                <span className="num text-[10px] text-ink-400">
                  {streamSteps.length} 步{running ? ' · 运行中' : ' · 已完成'}
                </span>
              </div>
              <div className="scroll-thin max-h-[380px] space-y-2 overflow-y-auto p-3">
                {streamSteps.length === 0 ? (
                  <div className="flex items-center gap-2 py-4 text-[11px] text-ink-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-500" /> 正在规划分派方案…
                  </div>
                ) : (
                  streamSteps.map((s) => (
                    <div key={s.id} className="rounded-xl border border-ink-200/70 bg-white p-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="num grid h-4 w-4 place-items-center rounded bg-brand-50 text-[9px] text-brand-600">{s.seq}</span>
                        <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[9px] text-ink-500">{PHASE_LABEL[s.phase]}</span>
                        {s.toolName ? <span className="num text-[9px] text-brand-500">{s.toolName}</span> : null}
                        <span
                          className={cn(
                            'ml-auto rounded-full px-1.5 py-0.5 text-[9px]',
                            s.resultCode === 'ok' ? 'bg-teal-50 text-teal-700' : 'bg-danger-50 text-danger-600'
                          )}
                        >
                          {s.resultCode}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] leading-relaxed text-ink-600">{s.summary}</div>
                      <div className="num mt-1 text-[9px] text-ink-300">{s.elapsedMs}ms</div>
                    </div>
                  ))
                )}
                {streamSummary ? (
                  <div className="rounded-xl bg-teal-50 p-2.5 text-[11px] leading-relaxed text-teal-800">
                    分派完成：{streamSummary.department} · 承诺时限 {fmtDateTime(streamSummary.deadline)} ·{' '}
                    {streamSummary.split ? '已拆单' : '未拆单'} · {streamSummary.findings} 个子问题
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-800">
                <Building2 className="h-4 w-4 text-teal-600" /> 分派记录
              </div>
              <span className="num rounded-full bg-ink-100 px-2 py-0.5 text-[10px] text-ink-500">{detail.assignments.length} 条</span>
            </div>

            <div className="mt-3 space-y-2.5">
              {detail.assignments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-ink-200 py-6 text-center text-[11px] text-ink-400">
                  暂无分派记录，等待 Agent 生成方案
                </div>
              ) : (
                detail.assignments.map((a) => (
                  <div key={a.id} className="rounded-xl border border-ink-200/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('chip px-2 py-0.5 text-[10px]', STATE_META[a.state].cls)}>{STATE_META[a.state].label}</span>
                      <span
                        className="chip px-2 py-0.5 text-[10px]"
                        style={{
                          background: ASSIGNMENT_SOURCE_META[a.source].soft,
                          color: ASSIGNMENT_SOURCE_META[a.source].color
                        }}
                      >
                        {ASSIGNMENT_SOURCE_META[a.source].label}
                      </span>
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                      <div>
                        <div className="text-[10px] text-ink-400">承办部门</div>
                        <div className="mt-0.5 font-medium text-ink-800">{a.department}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-ink-400">承办人</div>
                        <div className="mt-0.5 flex items-center gap-1 text-ink-700">
                          <UserRound className="h-3 w-3" /> {a.assignee}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-ink-400">承诺时限</div>
                        <div className="num mt-0.5 text-ink-700">{fmtDateTime(a.deadline)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-ink-400">回执号</div>
                        <div className="num mt-0.5 text-ink-600">{a.receiptNo ?? '—'}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-[10px] text-ink-400">跟进单 followupId</div>
                        <div className="num mt-0.5 text-ink-600">{a.followupId ?? '—'}</div>
                      </div>
                    </div>
                    <div className="mt-2 rounded-lg bg-ink-50 p-2 text-[10px] leading-relaxed text-ink-500">{a.reason}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-800">
              <Clock3 className="h-4 w-4 text-ink-400" /> 办理时间轴
            </div>
            <div className="relative mt-3 pl-4">
              <div className="absolute bottom-2 left-[5px] top-2 w-px bg-ink-200" />
              <div className="space-y-3.5">
                {detail.events.length === 0 ? (
                  <div className="text-[11px] text-ink-400">暂无事件</div>
                ) : (
                  detail.events.map((e, i) => {
                    const label = EVENT_LABEL[e.eventType];
                    const payloadNote =
                      typeof e.payload.note === 'string'
                        ? e.payload.note
                        : typeof e.payload.reason === 'string'
                          ? e.payload.reason
                          : '';
                    return (
                      <div key={e.id} className="relative">
                        <span
                          className={cn(
                            'absolute -left-[15px] top-1.5 h-2 w-2 rounded-full ring-2 ring-white',
                            i === detail.events.length - 1 && 'animate-pulse'
                          )}
                          style={{ background: label?.tone ?? '#667085' }}
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-ink-800">{label?.label ?? e.eventType}</span>
                          <span className="num shrink-0 text-[9px] text-ink-300">{fmtRelative(e.createdAt)}</span>
                        </div>
                        {payloadNote ? <div className="mt-0.5 text-[10px] leading-relaxed text-ink-500">{payloadNote}</div> : null}
                        <div className="mt-0.5 text-[9px] text-ink-300">
                          {e.actor} · <span className="num">{fmtDateTime(e.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-800">
                <Sparkles className="h-4 w-4 text-brand-500" /> Agent 步骤
              </div>
              <span className="num rounded-full bg-ink-100 px-2 py-0.5 text-[10px] text-ink-500">{detail.agentSteps.length} 步</span>
            </div>
            <div className="mt-3 space-y-2">
              {detail.agentSteps.length === 0 ? (
                <div className="rounded-xl border border-dashed border-ink-200 py-6 text-center text-[11px] text-ink-400">
                  暂无 Agent 步骤记录
                </div>
              ) : (
                detail.agentSteps.map((s) => (
                  <div key={s.id} className="rounded-xl bg-ink-50 p-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="num grid h-4 w-4 place-items-center rounded bg-white text-[9px] text-brand-600">{s.seq}</span>
                      <span className="rounded bg-white px-1.5 py-0.5 text-[9px] text-ink-500">{PHASE_LABEL[s.phase]}</span>
                      {s.toolName ? <span className="num text-[9px] text-brand-500">{s.toolName}</span> : null}
                      <span
                        className={cn(
                          'ml-auto rounded-full px-1.5 py-0.5 text-[9px]',
                          s.resultCode === 'ok' ? 'bg-teal-50 text-teal-700' : 'bg-danger-50 text-danger-600'
                        )}
                      >
                        {s.resultCode}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] leading-relaxed text-ink-600">{s.summary}</div>
                    <div className="num mt-1 text-[9px] text-ink-300">{s.elapsedMs}ms</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-center pt-1">
            <DemoTag />
          </div>
        </div>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm"
            onClick={() => {
              if (!modalBusy) setModal(null);
            }}
            aria-label="关闭弹窗"
          />
          <div className="animate-rise relative w-full max-w-md rounded-2xl border border-ink-200/70 bg-white p-5 shadow-float">
            <div className="flex items-center justify-between">
              <div className="text-[15px] font-semibold text-ink-900">{MODAL_TITLE[modal]}</div>
              <button
                onClick={() => {
                  if (!modalBusy) setModal(null);
                }}
                className="grid h-7 w-7 place-items-center rounded-lg text-ink-400 hover:bg-ink-100"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modal === 'confirm' ? (
              <div className="mt-3 space-y-2">
                <div className="text-[12px] leading-relaxed text-ink-600">
                  确认后将把 Agent 提议的分派方案正式下发至承办部门，并通知承办人。
                </div>
                <div className="rounded-xl bg-ink-50 p-3 text-[11px] leading-relaxed text-ink-500">
                  工单 <span className="num text-ink-700">{detail.code}</span> · 当前状态「待人工复核」。
                  如需调整部门 / 承办人 / 时限，请前往复核台编辑后确认。
                </div>
              </div>
            ) : modal === 'urge' ? (
              <div className="mt-3 space-y-2">
                {urge ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
                      <span className="rounded-full bg-danger-50 px-2 py-0.5 text-danger-600">
                        超时 {fmtHours(urge.overdueHours)}
                      </span>
                      <span>{urge.department}</span>
                      <span className="num text-ink-400">{urge.runId}</span>
                    </div>
                    <pre className="scroll-thin max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-ink-50 p-3 text-[12px] leading-relaxed text-ink-700">
                      {urge.draft}
                    </pre>
                  </>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {modal === 'reassign' && (
                  <label className="block">
                    <span className="text-[11px] text-ink-400">改派至承办部门</span>
                    <select
                      className="field mt-1 text-[13px]"
                      value={formDept}
                      onChange={(e) => setFormDept(e.target.value)}
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="block">
                  <span className="flex items-center gap-1 text-[11px] text-ink-400">
                    {modal === 'reject' ? '驳回理由' : modal === 'close' ? '处置说明' : '改派备注'}
                    {modal === 'reject' || modal === 'close' ? <span className="text-danger-500">*</span> : null}
                  </span>
                  <textarea
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value.slice(0, 300))}
                    rows={4}
                    placeholder={
                      modal === 'reject'
                        ? '若职责判定有误，请说明正确归属部门'
                        : modal === 'close'
                          ? '描述现场处置结果，将同步给市民查看'
                          : '说明改派原因（选填）'
                    }
                    className="field mt-1 resize-none text-[13px]"
                  />
                </label>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              {modal === 'urge' ? (
                <>
                  <button onClick={copyDraft} className="btn-ghost px-3 py-2 text-[12px]">
                    <Copy className="h-3.5 w-3.5" /> 复制文本
                  </button>
                  <button onClick={() => setModal(null)} className="btn-primary px-4 py-2 text-[12px]">
                    关闭
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setModal(null)}
                    disabled={modalBusy}
                    className="btn-ghost px-4 py-2 text-[12px]"
                  >
                    取消
                  </button>
                  <button
                    onClick={submitModal}
                    disabled={modalBusy}
                    className={cn('px-4 py-2 text-[12px]', modal === 'reject' ? 'btn-danger' : 'btn-primary')}
                  >
                    {modalBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : modal === 'close' ? <Send className="h-3.5 w-3.5" /> : null}
                    {modal === 'confirm' ? '确认下发' : modal === 'reassign' ? '提交改派' : modal === 'reject' ? '确认驳回' : '确认办结'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
