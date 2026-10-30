'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Code2,
  Cpu,
  Database,
  Loader2,
  Play,
  ShieldCheck,
  Sparkles,
  Wrench
} from 'lucide-react';
import { SectionTitle } from '@/components/ui/kit';
import { toast } from '@/components/ui/toast';
import { apiGet } from '@/lib/client';
import { THRESHOLDS } from '@/domain/constants';
import { cn } from '@/lib/utils';

interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  examples: { input: Record<string, unknown>; output: Record<string, unknown> }[];
}

interface ToolsResp {
  transport: string;
  version: string;
  tools: McpToolDescriptor[];
}

interface McpCallResponse {
  ok: boolean;
  resultCode: string;
  summary: string;
  data: Record<string, unknown>;
  latencyMs: number;
  tool: string;
  error?: string;
}

interface CallResult {
  tool: string;
  res: McpCallResponse;
}

const CAPABILITIES = [
  {
    icon: Sparkles,
    title: 'VLM 视觉识别',
    model: 'qwen-vl-max',
    meta: 'mock 模式 · 多图质控',
    desc: '质量检测、问题分类、证据框与置信度判定，低于闸门自动转人工。',
    tone: 'text-brand-600 bg-brand-50'
  },
  {
    icon: Database,
    title: 'RAG 知识检索',
    model: `阈值 ${THRESHOLDS.ragScore}`,
    meta: `TopK ${THRESHOLDS.ragTopK} · RRF 混合检索`,
    desc: '条款级召回职责划分、处置时限与技术规范，检索不足即拒答。',
    tone: 'text-teal-600 bg-teal-50'
  },
  {
    icon: Cpu,
    title: 'Agent 编排',
    model: `${THRESHOLDS.maxAgentSteps} 步上限`,
    meta: 'plan / act / observe / decide / reflect',
    desc: '多问题拆单、辖区匹配、职责检索与派单回执，全步骤可回放。',
    tone: 'text-brand-600 bg-brand-50'
  },
  {
    icon: Wrench,
    title: 'MCP 工具',
    model: '4 个工具',
    meta: 'JSON Schema · 带副作用',
    desc: '工单分派、部门通知、时限校验与知识检索，统一 MCP 契约。',
    tone: 'text-amber-600 bg-amber-50'
  }
];

const GATES = [
  { title: `置信度 ≥ ${THRESHOLDS.confidence}`, desc: '自动立案并进入 Agent 分派' },
  { title: `多问题拆单 ≥ ${THRESHOLDS.splitConfidence}`, desc: '同一现场拆分多个子问题分派' },
  { title: `RAG 相似度 ≥ ${THRESHOLDS.ragScore}`, desc: '引用条款进入办理依据' },
  { title: '低置信 / 模型降级', desc: '强制转人工复核，不自动下发' },
  { title: '紧急单先派后审', desc: '先行通知承办部门，100% 人工复核' }
];

function requiredFields(schema: Record<string, unknown>): string[] {
  const required = schema.required;
  return Array.isArray(required) ? required.filter((x): x is string => typeof x === 'string') : [];
}

function exampleText(tool: McpToolDescriptor): string {
  return JSON.stringify(tool.examples[0]?.input ?? {}, null, 2);
}

export default function AiCenterPage() {
  const [tools, setTools] = useState<McpToolDescriptor[]>([]);
  const [transport, setTransport] = useState('stdio');
  const [version, setVersion] = useState('1.0');
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const [argsText, setArgsText] = useState('');
  const [calling, setCalling] = useState(false);
  const [result, setResult] = useState<CallResult | null>(null);

  useEffect(() => {
    let alive = true;
    apiGet<ToolsResp>('/api/mcp/tools')
      .then((d) => {
        if (!alive) return;
        setTools(d.tools);
        setTransport(d.transport);
        setVersion(d.version);
      })
      .catch((err) => {
        if (alive) toast(err instanceof Error ? err.message : 'MCP 工具加载失败', 'error');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  function openTool(tool: McpToolDescriptor) {
    if (active === tool.name) {
      setActive(null);
      return;
    }
    setActive(tool.name);
    setArgsText(exampleText(tool));
    setResult(null);
  }

  async function callTool(tool: McpToolDescriptor) {
    if (calling) return;
    let args: unknown;
    try {
      args = JSON.parse(argsText);
    } catch {
      toast('args 不是合法 JSON，请检查格式', 'error');
      return;
    }
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      toast('args 必须是 JSON 对象', 'error');
      return;
    }
    setCalling(true);
    try {
      const res = await fetch(`/api/mcp/tools/${encodeURIComponent(tool.name)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mcp-token': 'demo-mcp-token' },
        body: JSON.stringify({ args })
      });
      const json = (await res.json()) as McpCallResponse;
      setResult({ tool: tool.name, res: json });
      if (res.ok && json.ok) {
        toast('工具调用成功', 'success', `${tool.name} · ${json.latencyMs}ms`);
      } else {
        toast(json.summary || json.error || '工具调用失败', 'error');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : '工具调用网络异常', 'error');
    } finally {
      setCalling(false);
    }
  }

  const activeTool = tools.find((t) => t.name === active) ?? null;

  return (
    <div className="space-y-5">
      <SectionTitle
        title="AI 能力中心"
        desc="视觉识别、知识检索、Agent 编排与 MCP 工具的统一能力视图，所有调用均可审计。"
        action={
          <div className="flex items-center gap-2">
            <span className="num rounded-xl bg-white px-3 py-2 text-[11px] text-ink-500 shadow-soft">MCP v{version}</span>
            <span className="rounded-xl bg-white px-3 py-2 text-[11px] text-ink-500 shadow-soft">
              transport <span className="num text-ink-700">{transport}</span>
            </span>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CAPABILITIES.map((cap) => (
          <div key={cap.title} className="card card-hover p-4">
            <div className={cn('grid h-8 w-8 place-items-center rounded-lg', cap.tone)}>
              <cap.icon className="h-4 w-4" />
            </div>
            <div className="mt-2.5 text-[13px] font-semibold text-ink-800">{cap.title}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="num rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-600">{cap.model}</span>
              <span className="text-[10px] text-ink-400">{cap.meta}</span>
            </div>
            <div className="mt-2 text-[10px] leading-relaxed text-ink-400">{cap.desc}</div>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[14px] font-semibold text-ink-800">
            <ShieldCheck className="h-4 w-4 text-teal-600" /> 安全闸门
          </div>
          <span className="text-[10px] text-ink-400">关键阈值取自设计说明书附录 B</span>
        </div>

        <div className="mt-3 flex flex-col gap-2 xl:flex-row xl:items-stretch">
          {GATES.map((g, i) => (
            <div key={g.title} className="flex flex-1 items-stretch gap-2">
              <div className="flex-1 rounded-xl border border-ink-200/70 bg-ink-50/70 px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="num grid h-4 w-4 place-items-center rounded-full bg-white text-[9px] text-brand-600">
                    {i + 1}
                  </span>
                  <span className="text-[11px] font-semibold text-ink-700">{g.title}</span>
                </div>
                <div className="mt-1 text-[10px] leading-relaxed text-ink-400">{g.desc}</div>
              </div>
              {i < GATES.length - 1 ? (
                <div className="hidden place-items-center text-ink-300 xl:grid">
                  <ChevronRight className="h-4 w-4" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle
          title="MCP 工具"
          desc="直接调用 MCP Server，查看工具契约、示例入参与实时返回。需要 x-mcp-token: demo-mcp-token。"
          action={
            <span className="num rounded-xl bg-white px-3 py-2 text-[11px] text-ink-500 shadow-soft">{tools.length} 个工具</span>
          }
        />

        {loading ? (
          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[150px] animate-pulse rounded-2xl bg-white/70" />
            ))}
          </div>
        ) : tools.length === 0 ? (
          <div className="card mt-3 p-8 text-center text-[12px] text-ink-400">MCP 工具列表为空</div>
        ) : (
          <div className="mt-3 grid items-start gap-3 xl:grid-cols-2">
            {tools.map((tool) => {
              const open = active === tool.name;
              const required = requiredFields(tool.inputSchema);
              return (
                <div key={tool.name} className={cn('card overflow-hidden transition', open && 'border-brand-200 ring-1 ring-brand-100')}>
                  <button onClick={() => openTool(tool)} className="flex w-full items-start gap-2.5 p-4 text-left">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                      <Wrench className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="num text-[12px] font-semibold text-ink-800">{tool.name}</span>
                        <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[9px] text-ink-500">
                          {required.length} 必填
                        </span>
                      </div>
                      <div className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-500">{tool.description}</div>
                    </div>
                    <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-ink-300 transition', open && 'rotate-180')} />
                  </button>

                  {open ? (
                    <div className="border-t border-ink-100 p-4">
                      <div className="flex flex-wrap gap-1.5">
                        {required.map((f) => (
                          <span key={f} className="num rounded bg-amber-50 px-1.5 py-0.5 text-[9px] text-amber-700">
                            {f}
                          </span>
                        ))}
                      </div>

                      <div className="mt-3">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-[10px] font-medium text-ink-500">
                            <Code2 className="h-3 w-3" /> args（JSON，默认填入 examples[0]）
                          </span>
                          <button
                            onClick={() => setArgsText(exampleText(tool))}
                            className="text-[10px] text-brand-600 hover:underline"
                          >
                            重置示例
                          </button>
                        </div>
                        <textarea
                          value={argsText}
                          onChange={(e) => setArgsText(e.target.value)}
                          rows={8}
                          spellCheck={false}
                          className="num mt-1.5 w-full resize-y rounded-xl border border-ink-200 bg-ink-50/60 p-3 text-[10px] leading-relaxed text-ink-700 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
                        />
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="num truncate text-[9px] text-ink-300">POST /api/mcp/tools/{tool.name}</span>
                        <button onClick={() => callTool(tool)} disabled={calling} className="btn-primary px-3 py-2 text-[11px]">
                          {calling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                          调用工具
                        </button>
                      </div>

                      {result && result.tool === tool.name ? (
                        <div className="mt-3 rounded-xl border border-ink-200/70 bg-ink-50/60 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                result.res.ok ? 'bg-teal-50 text-teal-700' : 'bg-danger-50 text-danger-600'
                              )}
                            >
                              {result.res.ok ? 'ok' : 'failed'}
                            </span>
                            <span className="num rounded-full bg-white px-2 py-0.5 text-[10px] text-ink-500">
                              resultCode: {result.res.resultCode}
                            </span>
                            <span className="num text-[10px] text-ink-400">{result.res.latencyMs}ms</span>
                          </div>
                          {result.res.summary ? (
                            <div className="mt-1.5 text-[11px] leading-relaxed text-ink-600">{result.res.summary}</div>
                          ) : null}
                          {result.res.error ? (
                            <div className="mt-1.5 text-[11px] text-danger-600">{result.res.error}</div>
                          ) : null}
                          <pre className="scroll-thin mt-2 max-h-56 overflow-auto rounded-lg bg-white p-2.5 text-[10px] leading-relaxed text-ink-600">
                            {JSON.stringify(result.res.data, null, 2)}
                          </pre>
                        </div>
                      ) : null}

                      {tool.examples.length ? (
                        <div className="mt-3">
                          <div className="text-[10px] font-medium text-ink-500">示例输出</div>
                          <pre className="scroll-thin mt-1 max-h-32 overflow-auto rounded-lg bg-white p-2.5 text-[10px] leading-relaxed text-ink-500">
                            {JSON.stringify(tool.examples[0]?.output ?? {}, null, 2)}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeTool ? (
        <div className="flex items-center gap-1.5 text-[10px] text-ink-400">
          <ArrowRight className="h-3 w-3" /> 当前展开：<span className="num text-ink-600">{activeTool.name}</span>
        </div>
      ) : null}
    </div>
  );
}
