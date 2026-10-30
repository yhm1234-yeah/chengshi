'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  MapPin,
  MessageCircleHeart,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound
} from 'lucide-react';
import { EvidencePhoto } from '@/components/EvidencePhoto';
import { CityMap } from '@/components/CityMap';
import { ConfidenceBar, DemoTag, SeverityBadge, StatusBadge, StatusFlow, TypeBadge } from '@/components/ui/kit';
import { toast } from '@/components/ui/toast';
import { apiGet, apiPost } from '@/lib/client';
import type { AgentStep, Assignment, TicketDetail } from '@/domain/types';
import { ASSIGNMENT_SOURCE_META, TYPE_META } from '@/domain/constants';
import { fmtDateTime, fmtHours, fmtRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

interface DetailResponse {
  detail: TicketDetail;
  creator: string;
}

const EVENT_LABEL: Record<string, { label: string; desc: string; tone: string }> = {
  submit: { label: '市民提交上报', desc: '照片与位置已上传，进入 AI 识别', tone: '#667085' },
  ai_file: { label: 'AI 识别立案', desc: '视觉模型完成判定并生成工单', tone: '#4C5DF0' },
  degrade_to_review: { label: '转人工复核', desc: '置信度不足或模型降级，交由坐席研判', tone: '#F59300' },
  dispatch: { label: 'AI 生成分派方案', desc: 'Agent 完成辖区匹配与职责检索', tone: '#4C5DF0' },
  confirm: { label: '坐席复核确认', desc: '分派方案已生效，通知承办部门', tone: '#12A38F' },
  reject: { label: '坐席驳回方案', desc: '方案被驳回，等待重新分派', tone: '#F04438' },
  accept: { label: '承办部门接单', desc: '现场处置开始', tone: '#12A38F' },
  close: { label: '承办部门办结', desc: '处置完成，等待市民评价', tone: '#12A38F' },
  urge: { label: '督办催办', desc: '已向承办部门发送催办通知', tone: '#F04438' },
  reassign: { label: '人工改派', desc: '坐席调整了承办部门', tone: '#12A38F' },
  rate_satisfied: { label: '市民满意评价', desc: '工单归档，积分已发放', tone: '#039855' },
  rate_unsatisfied: { label: '市民不满意', desc: '转督办重办，部门需重新处置', tone: '#F04438' }
};

const RATE_TAGS = ['处置及时', '现场干净', '沟通清晰', '问题彻底解决', '需要返工'];

const PHASE_LABEL: Record<AgentStep['phase'], string> = {
  plan: '规划',
  act: '执行',
  observe: '观察',
  decide: '决策',
  reflect: '反思'
};

export default function TicketDetailPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const isNew = search.get('new') === '1';

  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSteps, setShowSteps] = useState(false);
  const [rating, setRating] = useState<'satisfied' | 'unsatisfied' | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const code = decodeURIComponent(params.code);

  useEffect(() => {
    setLoading(true);
    apiGet<DetailResponse>(`/api/tickets/${encodeURIComponent(code)}`)
      .then(setData)
      .catch((err) => toast(err instanceof Error ? err.message : '加载失败', 'error'))
      .finally(() => setLoading(false));
  }, [code]);

  const detail = data?.detail;
  const assignment = useMemo<Assignment | undefined>(() => {
    if (!detail) return undefined;
    return detail.assignments.find((a) => a.state === 'active') ?? detail.assignments.find((a) => a.state === 'proposed') ?? detail.assignments[0];
  }, [detail]);

  const boxes = useMemo(() => {
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

  const photo = detail?.images[0]?.url;

  async function submitRate() {
    if (!rating) return toast('请选择满意或不满意', 'error');
    setSubmitting(true);
    try {
      const res = await apiPost<{ detail: TicketDetail; points: number }>(`/api/tickets/${code}/rate`, { rating, tags, comment });
      setData((prev) => (prev ? { ...prev, detail: res.detail } : prev));
      toast(rating === 'satisfied' ? '感谢评价，10 积分已到账' : '已转督办重办，我们会跟进', 'success');
      setRating(null);
      setTags([]);
      setComment('');
    } catch (err) {
      toast(err instanceof Error ? err.message : '评价失败', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="grid h-full min-h-[560px] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6 text-center">
        <div className="text-[14px] font-medium text-ink-700">工单不存在或无权查看</div>
        <Link href="/m/tickets" className="btn-primary mt-4 inline-flex">
          返回我的工单
        </Link>
      </div>
    );
  }

  const closed = detail.status === 'closed';
  const rated = detail.status === 'rated';

  return (
    <div className="min-h-full pb-6">
      <div className="sticky top-0 z-30 bg-white/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/m/tickets')} className="grid h-8 w-8 place-items-center rounded-full bg-ink-100 text-ink-600">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="text-[15px] font-semibold text-ink-900">工单详情</div>
          <Link href="/m/chat" className="flex items-center gap-1 text-[11px] text-ink-400">
            <MessageCircleHeart className="h-3.5 w-3.5" /> 助手
          </Link>
        </div>
      </div>

      {isNew ? (
        <div className="mx-5 mt-3 flex items-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-3.5 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600" />
          <div className="text-[11px] leading-relaxed text-teal-800">
            上报成功！{detail.needsReview ? 'AI 置信度不足，已转人工复核。' : 'AI 已自动立案并生成分派方案。'}
            <span className="ml-1 font-semibold">+5 积分</span>
          </div>
        </div>
      ) : null}

      <div className="px-5 pt-3">
        <div className="rounded-2xl border border-ink-200/70 bg-white p-4 shadow-soft">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="num text-[10px] text-ink-400">{detail.code}</div>
              <div className="mt-1 text-[17px] font-semibold leading-snug text-ink-900">{detail.title}</div>
            </div>
            <StatusBadge status={detail.status} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <TypeBadge type={detail.type} size="sm" />
            <SeverityBadge severity={detail.severity} size="sm" />
            {detail.degraded ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">AI 降级</span>
            ) : null}
            {detail.needsReview ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">待人工复核</span>
            ) : null}
          </div>

          <div className="mt-4">
            <StatusFlow status={detail.status} />
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2.5 text-[11px] text-ink-600">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-teal-600" />
            {STATUS_HINT[detail.status] ?? '工单处理中'}
          </div>
        </div>

        {photo ? (
          <EvidencePhoto
            src={photo}
            alt="市民上传的现场照片"
            boxes={boxes}
            className="mt-3 aspect-[4/3] w-full"
          />
        ) : null}

        <div className="mt-3 rounded-2xl border border-ink-200/70 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-800">
              <Sparkles className="h-3.5 w-3.5 text-brand-500" /> AI 识别结论
            </div>
            <span className="num text-[10px] text-ink-400">{detail.runs.find((r) => r.stage === 'classify')?.model ?? 'qwen-vl-max (mock)'}</span>
          </div>

          <div className="mt-3 flex items-center justify-between text-[10px] text-ink-400">
            <span>判定置信度</span>
            <span>{detail.confidence >= 0.75 && !detail.degraded ? '达到自动立案闸门（≥0.75）' : '低于闸门，已转人工'}</span>
          </div>
          <div className="mt-1">
            <ConfidenceBar value={detail.confidence} />
          </div>

          <div className="mt-3 space-y-2">
            {detail.findings.map((f, i) => (
              <div key={f.id} className="rounded-xl bg-ink-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="num text-[9px] text-ink-400">#{i + 1}</span>
                    <span className="text-[11px] font-semibold text-ink-800">{TYPE_META[f.type].label}</span>
                  </div>
                  <span className="num text-[10px] text-ink-400">{Math.round(f.confidence * 100)}%</span>
                </div>
                <div className="mt-1 text-[10px] leading-relaxed text-ink-500">{f.desc || '无补充描述'}</div>
              </div>
            ))}
          </div>

          {detail.description ? (
            <div className="mt-3 border-t border-ink-100 pt-3">
              <div className="text-[10px] text-ink-400">现场描述</div>
              <div className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-ink-600">{detail.description}</div>
            </div>
          ) : null}

          {detail.agentSteps.length ? (
            <div className="mt-3 border-t border-ink-100 pt-3">
              <button onClick={() => setShowSteps((v) => !v)} className="flex w-full items-center justify-between text-[11px] text-ink-600">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-brand-500" /> Agent 分派过程 · {detail.agentSteps.length} 步
                </span>
                <ChevronDown className={cn('h-3.5 w-3.5 text-ink-400 transition', showSteps && 'rotate-180')} />
              </button>
              {showSteps ? (
                <div className="mt-2 space-y-1.5">
                  {detail.agentSteps.map((s) => (
                    <div key={s.id} className="flex items-start gap-2 rounded-lg bg-ink-50 px-2.5 py-2">
                      <span className="num grid h-4 w-4 shrink-0 place-items-center rounded bg-white text-[9px] text-brand-600">{s.seq}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-white px-1 py-0.5 text-[9px] text-ink-500">{PHASE_LABEL[s.phase]}</span>
                          {s.toolName ? <span className="num text-[9px] text-brand-500">{s.toolName}</span> : null}
                        </div>
                        <div className="mt-0.5 text-[10px] leading-relaxed text-ink-600">{s.summary}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-3 rounded-2xl border border-ink-200/70 bg-white p-4">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-800">
            <Building2 className="h-3.5 w-3.5 text-teal-600" /> 分派与处置
          </div>

          {assignment ? (
            <div className="mt-3 space-y-2.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-ink-400">承办部门</span>
                <span className="font-medium text-ink-800">{assignment.department}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-400">承办人</span>
                <span className="flex items-center gap-1 text-ink-700">
                  <UserRound className="h-3 w-3" /> {assignment.assignee}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-400">承诺时限</span>
                <span className="flex items-center gap-1 text-ink-700">
                  <Clock3 className="h-3 w-3" /> {fmtDateTime(assignment.deadline)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-400">分派方式</span>
                <span className="chip px-2 py-0.5 text-[10px]" style={{ background: ASSIGNMENT_SOURCE_META[assignment.source].soft, color: ASSIGNMENT_SOURCE_META[assignment.source].color }}>
                  {ASSIGNMENT_SOURCE_META[assignment.source].label}
                  {assignment.state === 'proposed' ? ' · 待复核' : ''}
                </span>
              </div>
              <div className="rounded-xl bg-ink-50 p-2.5 text-[10px] leading-relaxed text-ink-500">{assignment.reason}</div>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-ink-200 py-4 text-center text-[11px] text-ink-400">
              AI 正在生成分派方案，或已转交坐席人工研判
            </div>
          )}

          <div className="mt-3 overflow-hidden rounded-xl border border-ink-200/60">
            <CityMap className="h-[132px]" points={[]} activePoint={{ lng: detail.lng, lat: detail.lat }} showLabels={false} showGrid={false} />
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex min-w-0 items-center gap-1 text-[10px] text-ink-500">
                <MapPin className="h-3 w-3 shrink-0 text-brand-500" />
                <span className="truncate">{detail.address}</span>
              </div>
              <span className="num shrink-0 text-[9px] text-ink-400">{detail.gridCode}</span>
            </div>
          </div>
        </div>

        {detail.guide.length ? (
          <div className="mt-3 rounded-2xl border border-teal-200/70 bg-teal-50/50 p-4">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-teal-800">
              <ShieldCheck className="h-3.5 w-3.5" /> 办理依据（知识库引用）
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
            <div className="mt-2 text-[9px] text-teal-700/70">引用条款来自演示知识库，仅用于说明责任与时限，不作为真实政策依据。</div>
          </div>
        ) : null}

        {closed || rated ? (
          <div className="mt-3 rounded-2xl border border-ink-200/70 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-800">
                <Star className="h-3.5 w-3.5 text-amber-500" /> 办理评价
              </div>
              {rated && detail.feedback ? (
                <span className="chip bg-teal-50 px-2 py-0.5 text-[10px] text-teal-700">
                  {detail.feedback.rating === 'satisfied' ? '满意' : '不满意'}
                </span>
              ) : null}
            </div>

            {rated && detail.feedback ? (
              <div className="mt-3">
                <div className="flex flex-wrap gap-1.5">
                  {detail.feedback.tags.length ? detail.feedback.tags.map((t) => (
                    <span key={t} className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] text-ink-600">{t}</span>
                  )) : <span className="text-[10px] text-ink-400">未选择标签</span>}
                </div>
                {detail.feedback.comment ? <div className="mt-2 text-[10px] leading-relaxed text-ink-500">{detail.feedback.comment}</div> : null}
                <div className="mt-2 text-[9px] text-ink-300">{fmtDateTime(detail.feedback.createdAt)}</div>
              </div>
            ) : (
              <div className="mt-3">
                <div className="text-[10px] text-ink-400">处置结果是否满意？不满意将自动转督办重办。</div>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {[
                    { key: 'satisfied' as const, label: '满意', icon: '👍', tone: 'border-teal-300 bg-teal-50 text-teal-700' },
                    { key: 'unsatisfied' as const, label: '不满意', icon: '👎', tone: 'border-danger-200 bg-danger-50 text-danger-700' }
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setRating(item.key)}
                      className={cn(
                        'rounded-xl border py-2.5 text-[12px] font-medium transition',
                        rating === item.key ? item.tone : 'border-ink-200 bg-white text-ink-500'
                      )}
                    >
                      <span className="mr-1">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>

                {rating ? (
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-1.5">
                      {RATE_TAGS.map((t) => (
                        <button
                          key={t}
                          onClick={() => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}
                          className={cn(
                            'rounded-full px-2.5 py-1 text-[10px] transition',
                            tags.includes(t) ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-500'
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value.slice(0, 200))}
                      rows={2}
                      placeholder="说说您的感受（选填）"
                      className="field mt-2 resize-none text-[11px]"
                    />
                    <button onClick={submitRate} disabled={submitting} className="btn-primary mt-2 w-full py-2.5 text-[12px]">
                      {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
                      提交评价
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-3 rounded-2xl border border-ink-200/70 bg-white p-4">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-800">
            <Clock3 className="h-3.5 w-3.5 text-ink-400" /> 办理轨迹
          </div>
          <div className="relative mt-3 pl-4">
            <div className="absolute bottom-2 left-[5px] top-2 w-px bg-ink-200" />
            <div className="space-y-3.5">
              {detail.events.map((e, i) => {
                const label = EVENT_LABEL[e.eventType];
                return (
                  <div key={e.id} className="relative">
                    <span
                      className={cn('absolute -left-[15px] top-1.5 h-2 w-2 rounded-full ring-2 ring-white', i === detail.events.length - 1 && 'animate-pulse')}
                      style={{ background: label?.tone ?? '#667085' }}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-ink-800">{label?.label ?? e.eventType}</span>
                      <span className="num text-[9px] text-ink-300">{fmtRelative(e.createdAt)}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-ink-400">{label?.desc ?? ''}</div>
                    <div className="mt-0.5 text-[9px] text-ink-300">{e.actor} · {fmtDateTime(e.createdAt)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {detail.assignments.length && detail.status !== 'closed' && detail.status !== 'rated' ? (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2 text-[10px] text-ink-500">
              <span>承诺时限 {fmtDateTime(assignment?.deadline ?? detail.updatedAt)}</span>
              <span className="text-ink-400">
                {assignment ? `剩余 ${fmtHours(Math.max(0, (new Date(assignment.deadline).getTime() - Date.now()) / 3600000))}` : ''}
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex justify-center">
          <DemoTag />
        </div>
      </div>
    </div>
  );
}

const STATUS_HINT: Record<string, string> = {
  submitted: '已提交，AI 正在识别照片与问题类型',
  ai_filed: 'AI 已完成立案，正在生成分派方案',
  pending_review: 'AI 分派方案需经网格坐席复核后正式下发，请耐心等待',
  assigned: '已分派至承办部门，处置人员将按承诺时限到场',
  processing: '承办部门现场处置中，完成后会通知您评价',
  closed: '已办结，请在 7 日内对办理结果进行评价',
  rated: '已完成评价，感谢您参与城市治理',
  reopened: '您的不满意评价已触发督办重办，部门将重新处置'
};
