'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowLeft, Clock3, Cpu, Radio, ShieldCheck, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { CityMap } from '@/components/CityMap';
import { EChart, donutOption, barOption } from '@/components/EChart';
import type { ScreenSummary } from '@/domain/types';
import { TYPE_META, STATUS_META } from '@/domain/constants';
import { fmtClock, fmtRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

const KIND_META = {
  new: { label: '新上报', color: '#36E5FF' },
  assigned: { label: '已分派', color: '#4D7CFF' },
  closed: { label: '已办结', color: '#7CF5C4' }
} as const;

export default function ScreenPage() {
  const [data, setData] = useState<ScreenSummary | null>(null);
  const [clock, setClock] = useState(() => fmtClock(new Date().toISOString()));
  const [live, setLive] = useState(false);
  const [pulse, setPulse] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setClock(fmtClock(new Date().toISOString())), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      const es = new EventSource('/api/screen');
      esRef.current = es;
      const handle = (e: MessageEvent<string>) => {
        try {
          setData(JSON.parse(e.data) as ScreenSummary);
          setLive(true);
          setPulse((p) => p + 1);
        } catch {
          // ignore malformed chunk
        }
      };
      es.addEventListener('init', handle as EventListener);
      es.addEventListener('tick', handle as EventListener);
      es.addEventListener('error', () => {
        setLive(false);
        if (!cancelled) {
          es.close();
          fetch('/api/screen/summary')
            .then((r) => r.json())
            .then((json: { data?: ScreenSummary }) => {
              if (json.data) setData(json.data);
            })
            .catch(() => undefined);
        }
      });
    };

    connect();

    // 兜底轮询：SSE 断开时每 15 秒刷新
    const poll = setInterval(() => {
      if (live) return;
      fetch('/api/screen/summary')
        .then((r) => r.json())
        .then((json: { data?: ScreenSummary }) => {
          if (json.data) setData(json.data);
        })
        .catch(() => undefined);
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      esRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heat = useMemo(
    () =>
      (data?.heatPoints ?? []).map((p) => ({
        lng: p.lng,
        lat: p.lat,
        weight: p.weight,
        severity: p.severity,
        color: TYPE_META[p.type]?.color
      })),
    [data]
  );

  const maxDistrict = Math.max(1, ...(data?.districtRanking ?? []).map((d) => d.count));

  return (
    <div className="relative min-h-screen overflow-hidden bg-screen-bg text-white">
      <div className="screen-grid pointer-events-none absolute inset-0 opacity-70" />
      <div className="screen-vignette pointer-events-none absolute inset-0" />

      <div className="relative mx-auto flex min-h-screen max-w-[1680px] flex-col px-6 pb-5 pt-5">
        {/* 顶栏 */}
        <header className="flex items-center justify-between border-b border-screen-line/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-screen-cyan/30 bg-screen-panel">
              <svg width="22" height="22" viewBox="0 0 40 40" fill="none" aria-hidden>
                <circle cx="20" cy="20" r="16" stroke="#36E5FF" strokeWidth="1.2" opacity=".4" />
                <path d="M20 8.5c-4.6 0-8.3 3.6-8.3 8.1 0 5.7 8.3 13.4 8.3 13.4s8.3-7.7 8.3-13.4c0-4.5-3.7-8.1-8.3-8.1Z" fill="#36E5FF" opacity=".85" />
                <circle cx="20" cy="16.4" r="1.6" fill="#04070F" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[22px] font-semibold tracking-[0.08em]">城市治理智能指挥中心</h1>
                <span className="rounded border border-screen-cyan/30 bg-screen-cyan/10 px-1.5 py-0.5 text-[9px] tracking-[0.18em] text-screen-cyan">DEMO</span>
              </div>
              <div className="mt-1 text-[10px] tracking-[0.16em] text-screen-muted">CHENGSHI · AI CITY OPERATIONS CENTER · 云溪区 / 青梧区</div>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className={cn('flex items-center gap-2 text-[11px]', live ? 'text-screen-lime' : 'text-amber-400')}>
              <span className={cn('h-2 w-2 rounded-full', live ? 'animate-pulse bg-screen-lime' : 'bg-amber-400')} />
              {live ? '实时数据流已连接' : '数据流重连中'}
            </div>
            <div className="text-right">
              <div className="num text-[26px] font-semibold leading-none tracking-wider text-screen-cyan">{clock}</div>
              <div className="mt-1 text-[10px] text-screen-muted">UTC+8 · Asia/Shanghai</div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admin" className="flex items-center gap-1.5 rounded-lg border border-screen-line bg-screen-panel px-3 py-2 text-[11px] text-screen-text/80 transition hover:border-screen-cyan/40">
                <ArrowLeft className="h-3.5 w-3.5" /> 管理端
              </Link>
              <Link href="/m" className="rounded-lg border border-screen-line bg-screen-panel px-3 py-2 text-[11px] text-screen-text/80 transition hover:border-screen-cyan/40">
                市民端
              </Link>
            </div>
          </div>
        </header>

        {/* KPI */}
        <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            {
              label: '今日上报',
              value: data?.metrics.todayReports ?? '—',
              unit: '件',
              hint: `累计 ${data?.totalTickets ?? '—'} 件`,
              icon: Radio,
              accent: '#36E5FF'
            },
            {
              label: 'AI 自动立案率',
              value: data ? `${Math.round(data.metrics.autoFileRate * 100)}` : '—',
              unit: '%',
              hint: '置信度 ≥ 0.75 自动立案',
              icon: Sparkles,
              accent: '#4D7CFF'
            },
            {
              label: '平均响应时长',
              value: data?.metrics.avgResponseHours ?? '—',
              unit: '小时',
              hint: '从上报到部门接单',
              icon: Clock3,
              accent: '#7CF5C4'
            },
            {
              label: '整体办结率',
              value: data ? `${Math.round(data.metrics.completionRate * 100)}` : '—',
              unit: '%',
              hint: '含已评价与督办重办',
              icon: ShieldCheck,
              accent: '#FFC24D'
            },
            {
              label: 'Agent 实时链路',
              value: '8',
              unit: '步',
              hint: 'RAG + MCP · 全链路审计',
              icon: Cpu,
              accent: '#A78BFA'
            }
          ].map((kpi) => (
            <div key={kpi.label} className="panel-dark relative overflow-hidden p-4">
              <div className="absolute right-3 top-3 opacity-40">
                <kpi.icon className="h-4 w-4" style={{ color: kpi.accent }} />
              </div>
              <div className="text-[10px] tracking-[0.12em] text-screen-muted">{kpi.label}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="num text-[32px] font-semibold leading-none" style={{ color: kpi.accent }}>
                  {kpi.value}
                </span>
                <span className="text-[10px] text-screen-muted">{kpi.unit}</span>
              </div>
              <div className="mt-2 text-[10px] text-screen-muted/80">{kpi.hint}</div>
              <div className="mt-2 h-px w-full bg-gradient-to-r from-transparent via-screen-line to-transparent" />
            </div>
          ))}
        </section>

        {/* 主区域 */}
        <section className="mt-3 grid flex-1 grid-cols-1 gap-3 xl:grid-cols-[1.7fr_1fr]">
          <div className="flex min-h-[420px] flex-col gap-3">
            <div className="panel-dark relative flex flex-1 flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3.5">
                <div>
                  <div className="flex items-center gap-2 text-[13px] font-medium tracking-wide">
                    <Activity className="h-4 w-4 text-screen-cyan" /> 全域问题热力与网格态势
                  </div>
                  <div className="mt-1 text-[10px] text-screen-muted">虚构城市 · 2 行政区 · 6 责任网格 · 点位来自演示工单</div>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  {[
                    { label: '紧急', color: '#FF7070' },
                    { label: '较重', color: '#FFC24D' },
                    { label: '一般', color: '#7CF5C4' }
                  ].map((l) => (
                    <span key={l.label} className="flex items-center gap-1 text-screen-muted">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.color }} /> {l.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative flex-1">
                <CityMap dark points={heat} className="absolute inset-0 h-full w-full" showLabels />
                <div className="pointer-events-none absolute bottom-3 left-4 rounded-lg border border-screen-line bg-screen-bg/80 px-3 py-2 backdrop-blur">
                  <div className="text-[9px] text-screen-muted">实时点位</div>
                  <div className="num mt-0.5 text-[18px] font-semibold text-screen-cyan">{heat.length}</div>
                </div>
                <div className="pointer-events-none absolute bottom-3 right-4 rounded-lg border border-screen-line bg-screen-bg/80 px-3 py-2 backdrop-blur">
                  <div className="text-[9px] text-screen-muted">最后刷新</div>
                  <div className="num mt-0.5 text-[11px] text-screen-text/80">{data ? fmtRelative(data.updatedAt) : '—'}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="panel-dark p-4 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[12px] font-medium">
                    <Zap className="h-3.5 w-3.5 text-screen-amber" /> 实时工单事件流
                  </div>
                  <span className="flex items-center gap-1 text-[9px] text-screen-muted">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-screen-cyan" /> LIVE
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {(data?.recentEvents ?? []).slice(0, 6).map((e) => (
                    <div key={e.id} className="flex items-center gap-2 rounded-lg border border-screen-line/50 bg-[#07101F] px-2.5 py-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: KIND_META[e.kind].color }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="num text-[9px] text-screen-muted">{e.code}</span>
                          <span className="rounded px-1 text-[8px]" style={{ background: `${KIND_META[e.kind].color}18`, color: KIND_META[e.kind].color }}>
                            {KIND_META[e.kind].label}
                          </span>
                        </div>
                        <div className="truncate text-[10px] text-screen-text/80">{e.title}</div>
                      </div>
                      <span className="num shrink-0 text-[8px] text-screen-muted">{fmtRelative(e.at)}</span>
                    </div>
                  ))}
                  {!data?.recentEvents.length ? <div className="py-6 text-center text-[10px] text-screen-muted">等待事件…</div> : null}
                </div>
              </div>

              <div className="panel-dark flex flex-col p-4">
                <div className="text-[12px] font-medium">AI 链路健康度</div>
                <div className="mt-3 space-y-2.5">
                  {[
                    { label: '视觉识别 VLM', value: 'qwen-vl-max', state: 'mock 模式', tone: '#4D7CFF' },
                    { label: '知识检索 RAG', value: 'top-3 · ≥0.2', state: '正常', tone: '#7CF5C4' },
                    { label: 'Agent 编排', value: '≤8 步', state: '正常', tone: '#7CF5C4' },
                    { label: 'MCP 工具', value: '4 tools', state: 'stdin', tone: '#FFC24D' }
                  ].map((r) => (
                    <div key={r.label} className="flex items-center justify-between rounded-lg border border-screen-line/50 bg-[#07101F] px-2.5 py-2">
                      <div>
                        <div className="text-[10px] text-screen-text/85">{r.label}</div>
                        <div className="num text-[8px] text-screen-muted">{r.value}</div>
                      </div>
                      <span className="flex items-center gap-1 text-[9px]" style={{ color: r.tone }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.tone }} /> {r.state}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-auto pt-3 text-[9px] leading-relaxed text-screen-muted">
                  安全闸门：低置信自动转人工 · 紧急单先派后审 100% 复核 · 无依据即拒答
                </div>
              </div>
            </div>
          </div>

          {/* 右侧栏 */}
          <div className="flex flex-col gap-3">
            <div className="panel-dark p-4">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-medium">问题类型分布</div>
                <span className="text-[9px] text-screen-muted">全量工单</span>
              </div>
              <EChart
                option={donutOption(
                  (data?.typeDistribution ?? []).map((t) => ({ label: t.label, count: t.count, color: t.color })),
                  true
                )}
                height={210}
                dark
              />
            </div>

            <div className="panel-dark p-4">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-medium">区域工单排名</div>
                <TrendingUp className="h-3.5 w-3.5 text-screen-cyan" />
              </div>
              <div className="mt-3 space-y-3">
                {(data?.districtRanking ?? []).map((d) => (
                  <div key={d.district}>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-screen-text/85">{d.district}</span>
                      <span className="num text-screen-muted">{d.count} 件 · {d.avgResponseHours}h</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-screen-line/40">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-screen-cyan/60 to-screen-blue transition-all duration-1000"
                        style={{ width: `${Math.max(6, (d.count / maxDistrict) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel-dark flex flex-1 flex-col p-4">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-medium">高频类型 · 处置压力</div>
                <span className="text-[9px] text-screen-muted">Top 7</span>
              </div>
              <EChart
                option={barOption(
                  (data?.typeDistribution ?? [])
                    .slice()
                    .sort((a, b) => b.count - a.count)
                    .map((t) => ({ label: TYPE_META[t.type].short, count: t.count, color: TYPE_META[t.type].color })),
                  true
                )}
                height={216}
                dark
              />
            </div>
          </div>
        </section>

        <footer className="mt-3 flex items-center justify-between border-t border-screen-line/50 pt-2.5 text-[9px] text-screen-muted">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-screen-cyan" />
              SSE 5s 推送 · 第 {pulse} 帧
            </span>
            <span>状态机驱动 · 全量动作留痕 · 审计留存 90 天</span>
          </div>
          <span>演示数据，非真实政务系统 · 城事 CHENGSHI 2026</span>
        </footer>
      </div>
    </div>
  );
}
