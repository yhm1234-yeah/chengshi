'use client';

import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, Database, Loader2, ScrollText, Search, ShieldCheck } from 'lucide-react';
import { Empty } from '@/components/ui/kit';
import { toast } from '@/components/ui/toast';
import { apiGet } from '@/lib/client';
import type { AiRun, HumanAction } from '@/domain/types';
import { THRESHOLDS } from '@/domain/constants';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

interface AuditRow extends AiRun {
  ticketCode: string | null;
  ticketTitle: string | null;
  steps: number;
}

interface AuditResp {
  rows: AuditRow[];
  total: number;
}

const STAGES: { key: string; label: string }[] = [
  { key: '', label: '全部阶段' },
  { key: 'classify', label: 'classify 识别' },
  { key: 'locate', label: 'locate 定位' },
  { key: 'describe', label: 'describe 描述' },
  { key: 'dispatch', label: 'dispatch 分派' },
  { key: 'guide', label: 'guide 指引' },
  { key: 'chat', label: 'chat 问答' },
  { key: 'urge', label: 'urge 催办' }
];

const HUMAN_ACTION_LABEL: Record<HumanAction, string> = {
  confirm: '确认',
  reassign: '改派',
  reject: '驳回',
  none: '未干预'
};

export default function AuditPage() {
  const [stage, setStage] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState('');
  const [fallbackOnly, setFallbackOnly] = useState(false);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setCode(codeInput.trim()), 350);
    return () => clearTimeout(t);
  }, [codeInput]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const params = new URLSearchParams({ limit: '80' });
    if (stage) params.set('stage', stage);
    if (code) params.set('code', code);
    if (fallbackOnly) params.set('fallback', '1');

    apiGet<AuditResp>(`/api/admin/audit?${params.toString()}`)
      .then((d) => {
        if (!alive) return;
        setRows(d.rows);
        setTotal(d.total);
      })
      .catch((err) => {
        if (!alive) return;
        toast(err instanceof Error ? err.message : '审计记录加载失败', 'error');
        setRows([]);
        setTotal(0);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [stage, code, fallbackOnly]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="h2 flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-brand-500" /> 审计中心
          </div>
          <div className="mt-1 text-[12px] text-ink-400">每一次 AI 调用均落入 ai_runs，可检索、可追溯、可回放。</div>
        </div>
        <span className="num rounded-xl bg-white px-3 py-2 text-[12px] text-ink-500 shadow-soft">本次 {total} 条</span>
      </div>

      <div className="rounded-2xl border border-brand-200/70 bg-brand-50/50 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-brand-600">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-brand-800">AI 调用全链路留存</div>
            <div className="mt-1 text-[11px] leading-relaxed text-ink-500">
              审计记录留存 <span className="num font-semibold text-ink-700">{THRESHOLDS.auditRetentionDays} 天</span>
              ，记录模型、prompt 摘要、输入摘要、tokens、耗时、降级与兜底标记、人工干预结果，以及 Agent 每步工具调用。
              涉及市民隐私的原始图片与手机号不入审计表。
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[10px] text-ink-500">
            <Database className="h-3.5 w-3.5 text-teal-500" /> ai_runs / agent_steps
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-inset ring-ink-200 focus-within:ring-brand-400">
            <Search className="h-4 w-4 shrink-0 text-ink-400" />
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="按工单编号筛选，例如 CS2026…"
              className="w-full bg-transparent text-[13px] text-ink-800 outline-none placeholder:text-ink-400"
            />
            {loading ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-500" /> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="field w-auto min-w-[150px] px-3 py-2 text-[12px]" value={stage} onChange={(e) => setStage(e.target.value)}>
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setFallbackOnly((v) => !v)}
              aria-pressed={fallbackOnly}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] transition',
                fallbackOnly
                  ? 'border-amber-200 bg-amber-50 font-medium text-amber-700'
                  : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
              )}
            >
              仅看降级 / 兜底
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg bg-ink-100/70" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty title="没有匹配的 AI 调用记录" desc="调整工单编号、阶段或降级筛选后重试。" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1140px] border-collapse text-left">
              <thead>
                <tr className="bg-ink-50 text-[11px] font-medium text-ink-500">
                  <th className="whitespace-nowrap px-4 py-2.5">时间</th>
                  <th className="whitespace-nowrap px-3 py-2.5">阶段</th>
                  <th className="whitespace-nowrap px-3 py-2.5">模型</th>
                  <th className="whitespace-nowrap px-3 py-2.5">工单</th>
                  <th className="whitespace-nowrap px-3 py-2.5">tokens</th>
                  <th className="whitespace-nowrap px-3 py-2.5">耗时</th>
                  <th className="whitespace-nowrap px-3 py-2.5">兜底</th>
                  <th className="whitespace-nowrap px-3 py-2.5">降级</th>
                  <th className="whitespace-nowrap px-3 py-2.5">人工</th>
                  <th className="whitespace-nowrap px-3 py-2.5">promptDigest</th>
                  <th className="w-8 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 text-[12px]">
                {rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() => setExpanded((cur) => (cur === r.id ? null : r.id))}
                      className="cursor-pointer transition odd:bg-ink-50/40 hover:bg-brand-50/50"
                    >
                      <td className="num whitespace-nowrap px-4 py-2.5 text-[10px] text-ink-400">{fmtDateTime(r.createdAt)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600">{r.stage}</span>
                      </td>
                      <td className="num whitespace-nowrap px-3 py-2.5 text-[10px] text-ink-600">{r.model}</td>
                      <td className="max-w-[190px] px-3 py-2.5">
                        {r.ticketCode ? (
                          <div className="min-w-0">
                            <div className="num text-[10px] text-ink-500">{r.ticketCode}</div>
                            <div className="truncate text-[10px] text-ink-400">{r.ticketTitle}</div>
                          </div>
                        ) : (
                          <span className="text-ink-300">—</span>
                        )}
                      </td>
                      <td className="num whitespace-nowrap px-3 py-2.5 text-[10px] text-ink-500">
                        {r.tokensIn}/{r.tokensOut}
                      </td>
                      <td className="num whitespace-nowrap px-3 py-2.5 text-[10px] text-ink-500">{r.latencyMs}ms</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {r.fallbackUsed ? (
                          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] text-amber-700">是</span>
                        ) : (
                          <span className="text-[10px] text-ink-300">否</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {r.degraded ? (
                          <span className="rounded-full bg-danger-50 px-1.5 py-0.5 text-[9px] text-danger-600">降级</span>
                        ) : (
                          <span className="text-[10px] text-ink-300">正常</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[10px] text-ink-500">{HUMAN_ACTION_LABEL[r.humanAction]}</td>
                      <td className="max-w-[180px] px-3 py-2.5">
                        <span className="num block truncate text-[9px] text-ink-400">{r.promptDigest}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <ChevronDown className={cn('h-3.5 w-3.5 text-ink-300 transition', expanded === r.id && 'rotate-180')} />
                      </td>
                    </tr>
                    {expanded === r.id ? (
                      <tr>
                        <td colSpan={11} className="bg-ink-50/60 px-4 py-3">
                          <div className="grid gap-3 lg:grid-cols-2">
                            <div>
                              <div className="text-[10px] font-medium text-ink-500">inputDigest</div>
                              <pre className="scroll-thin mt-1 max-h-36 overflow-auto rounded-lg bg-white p-2.5 text-[10px] leading-relaxed text-ink-600">
                                {r.inputDigest}
                              </pre>
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-[10px] font-medium text-ink-500">
                                <span>outputJson</span>
                                <span className="num text-[9px] text-ink-400">Agent 步骤 {r.steps}</span>
                              </div>
                              <pre className="scroll-thin mt-1 max-h-36 overflow-auto rounded-lg bg-white p-2.5 text-[10px] leading-relaxed text-ink-600">
                                {JSON.stringify(r.outputJson, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
