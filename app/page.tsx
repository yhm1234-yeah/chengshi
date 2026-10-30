import Link from 'next/link';
import {
  ArrowRight,
  ScanLine,
  GitBranch,
  ShieldCheck,
  BookOpen,
  Plug,
  Activity,
  MapPin,
  Clock3,
  CheckCircle2,
  Sparkles,
  Layers,
  Fingerprint
} from 'lucide-react';
import { Logo, DemoTag, TypeBadge } from '@/components/ui/kit';
import { CityMap } from '@/components/CityMap';
import { GRIDS } from '@/domain/constants';

const FLOW = [
  { step: '01', title: '随手拍', desc: '市民拍照或从相册选择，最多 3 张，自动读取拍摄时间与定位。', icon: ScanLine },
  { step: '02', title: 'AI 识别', desc: '视觉模型输出类型、严重度、置信度与证据框，一次可识别多个问题。', icon: Sparkles },
  { step: '03', title: 'Agent 分派', desc: '职责检索 + 网格负载 + MCP 工具调用，生成可执行分派方案。', icon: GitBranch },
  { step: '04', title: '人工复核', desc: '坐席确认、改派或驳回，AI 不直接下派，责任始终在人。', icon: ShieldCheck }
];

const CAPABILITIES = [
  {
    title: '多问题拆单',
    desc: '一张照片里同时有破损井盖与违停车辆时，输出两条独立子问题，分别派发给不同承办部门。',
    icon: Layers,
    tone: 'brand'
  },
  {
    title: '证据框可视化',
    desc: '归一化坐标叠加在照片上，复议与督办时可回溯 AI 的判定位置，避免“黑箱”。',
    icon: Fingerprint,
    tone: 'teal'
  },
  {
    title: 'RAG 可溯源',
    desc: '职责划分、处置时限、技术规范三类知识库，条款级检索并展示出处，检索不足即拒答。',
    icon: BookOpen,
    tone: 'amber'
  },
  {
    title: 'MCP 工具治理',
    desc: '派单、通知、负载查询、督办提醒全部封装为 MCP 工具，有输入输出契约与审计记录。',
    icon: Plug,
    tone: 'ink'
  },
  {
    title: '全链路审计',
    desc: '每一次模型调用、Agent 步骤与人工动作都留痕，可按工单、阶段、模型与降级状态检索。',
    icon: Activity,
    tone: 'brand'
  },
  {
    title: '安全闸门',
    desc: '置信度低于 0.75 转人工，多问题拆单阈值 0.7，紧急单先派后审且 100% 复核。',
    icon: ShieldCheck,
    tone: 'danger'
  }
];

const PORTALS = [
  {
    href: '/login?role=citizen',
    title: '市民端',
    sub: '随手拍上报 · 进度查询 · 结果评价',
    desc: '五步完成上报，AI 实时反馈识别结果，工单全程可视。',
    tone: 'from-[#4C5DF0] to-[#7A5AF8]',
    tag: 'CITIZEN'
  },
  {
    href: '/login?role=staff',
    title: '管理端',
    sub: '复核台 · 督办 · 审计 · 知识库',
    desc: 'AI 只给建议，坐席决定结果；超时自动预警，全链路可审计。',
    tone: 'from-[#0B8474] to-[#12A38F]',
    tag: 'OPERATOR'
  },
  {
    href: '/screen',
    title: '指挥大屏',
    sub: '实时工单 · 热力分布 · 考核指标',
    desc: '面向指挥中心的一屏统览，SSE 增量推送，5 秒刷新。',
    tone: 'from-[#0A1424] to-[#18304F]',
    tag: 'COMMAND'
  }
];

const METRICS = [
  { label: 'AI 自动立案率', value: '92.6%', hint: '置信度 ≥ 0.75 直接立案' },
  { label: 'AI 分派采纳率', value: '87.4%', hint: '坐席确认口径，含改派' },
  { label: '平均响应时长', value: '3.4h', hint: '提交到首次响应' },
  { label: '按期办结率', value: '85.7%', hint: '含督办后办结' }
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#F7F8FC]">
      {/* 背景 */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(76,93,240,.18),transparent_65%)]" />
        <div className="absolute right-[-10%] top-[20%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(18,163,143,.14),transparent_65%)]" />
        <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(16,24,40,.14)_1px,transparent_1px)] [background-size:22px_22px]" />
      </div>

      <header className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-6">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-8 text-[13px] text-ink-500 md:flex">
          <a href="#flow" className="transition hover:text-ink-900">办理流程</a>
          <a href="#capability" className="transition hover:text-ink-900">AI 能力</a>
          <a href="#tech" className="transition hover:text-ink-900">技术亮点</a>
          <Link href="/screen" className="transition hover:text-ink-900">指挥大屏</Link>
        </nav>
        <div className="flex items-center gap-3">
          <DemoTag className="hidden sm:inline-flex" />
          <Link href="/login" className="btn-ghost">
            进入演示
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-[1180px] items-center gap-12 px-6 pb-8 pt-10 lg:grid-cols-[1.05fr_.95fr] lg:pt-16">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3 py-1.5 text-[12px] font-medium text-brand-700 shadow-sm backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ring rounded-full bg-brand-400" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
            </span>
            多模态识别 · 多 Agent 协同 · 人工在环
          </div>
          <h1 className="mt-6 text-balance text-[42px] font-semibold leading-[1.12] tracking-tight text-ink-900 sm:text-[54px]">
            让城市的每一件小事
            <br />
            <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-teal-500 bg-clip-text text-transparent">都被看见、被办成</span>
          </h1>
          <p className="mt-5 max-w-[520px] text-[15px] leading-relaxed text-ink-500">
            「城事」把市民身边的一平米问题，变成一条可被追踪、可被复核、可被问责的治理链路。
            拍照即上报，AI 识别问题与责任部门，坐席一键复核，进度实时回传。
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/login?role=citizen" className="btn-primary px-6 py-3 text-[15px]">
              市民随手拍
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login?role=staff" className="btn-ghost px-5 py-3 text-[15px]">
              坐席复核台
            </Link>
            <Link href="/screen" className="btn-ghost px-5 py-3 text-[15px]">
              指挥大屏
            </Link>
          </div>

          <div className="mt-9 grid max-w-[560px] grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {METRICS.map((m) => (
              <div key={m.label}>
                <div className="text-[11px] text-ink-400">{m.label}</div>
                <div className="num mt-1 text-[24px] font-semibold leading-none text-ink-900">{m.value}</div>
                <div className="mt-1 text-[10px] leading-tight text-ink-300">{m.hint}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 视觉：手机 + 地图 */}
        <div className="relative mx-auto w-full max-w-[520px]">
          <div className="absolute -left-6 top-6 hidden h-[420px] w-[420px] rounded-3xl bg-white/60 shadow-card backdrop-blur md:block" />
          <div className="relative ml-auto w-[300px] animate-floaty rounded-[34px] border-[10px] border-[#0C1017] bg-white shadow-[0_30px_70px_rgba(16,24,40,.28)]">
            <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-[#0C1017]" />
            <div className="overflow-hidden rounded-[26px]">
              <div className="relative h-[210px] w-full overflow-hidden bg-ink-200">
                <img src="/images/manhole.jpg" alt="井盖破损现场" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
                <div className="scan-wrap absolute inset-0">
                  <div className="scan-line animate-scan" />
                </div>
                <div className="absolute left-[18%] top-[55%] h-[26%] w-[34%] rounded-md border-2 border-screen-cyan/90 shadow-glow">
                  <span className="absolute -top-6 left-0 rounded bg-screen-cyan px-1.5 py-0.5 text-[9px] font-semibold text-screen-bg">
                    井盖破损 · 95%
                  </span>
                </div>
                <div className="absolute right-3 top-3 rounded-full bg-black/45 px-2 py-1 text-[10px] text-white backdrop-blur">
                  AI 识别中…
                </div>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <TypeBadge type="T01" size="sm" />
                  <span className="rounded-full bg-danger-50 px-2 py-0.5 text-[10px] font-medium text-danger-600">紧急 · 2 小时</span>
                </div>
                <div className="h-2 w-4/5 rounded-full bg-ink-200" />
                <div className="h-2 w-2/3 rounded-full bg-ink-100" />
                <div className="rounded-xl bg-brand-50 p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-brand-700">
                    <GitBranch className="h-3 w-3" />
                    Agent 已完成 8 步编排
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[9px] text-ink-500">
                    <span className="rounded bg-white px-1.5 py-0.5">辖区匹配</span>
                    <span className="text-ink-300">→</span>
                    <span className="rounded bg-white px-1.5 py-0.5">职责检索</span>
                    <span className="text-ink-300">→</span>
                    <span className="rounded bg-white px-1.5 py-0.5">MCP 派单</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-teal-600">
                  <CheckCircle2 className="h-3 w-3" />
                  已生成分派建议，等待坐席复核
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 -mt-6 mr-0 w-full max-w-[430px] rounded-2xl border border-white/70 bg-white/80 p-3 shadow-card backdrop-blur">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-600">
                <MapPin className="h-3 w-3 text-brand-500" />
                云溪区 · 实时工单热力
              </div>
              <span className="text-[10px] text-ink-400">6 个网格</span>
            </div>
            <CityMap
              className="h-[220px]"
              points={GRIDS.map((g, i) => ({ lng: g.center.lng, lat: g.center.lat, weight: i % 3 === 0 ? 3 : 1, severity: i % 5 === 0 ? 'urgent' : 'low' }))}
            />
          </div>

          <div className="absolute -right-2 bottom-24 z-20 hidden rounded-xl border border-white/80 bg-white/90 px-3 py-2 shadow-card backdrop-blur md:block">
            <div className="text-[10px] text-ink-400">今日上报</div>
            <div className="num text-[20px] font-semibold text-ink-900">18</div>
            <div className="mt-1 flex items-center gap-1 text-[10px] text-teal-600">
              <Clock3 className="h-3 w-3" /> 平均响应 3.4h
            </div>
          </div>
        </div>
      </section>

      {/* 流程 */}
      <section id="flow" className="mx-auto max-w-[1180px] px-6 py-20">
        <div className="flex items-end justify-between">
          <div>
            <div className="label text-brand-600">HOW IT WORKS</div>
            <h2 className="mt-3 text-[30px] font-semibold tracking-tight text-ink-900">一条工单的四段旅程</h2>
            <p className="mt-2 max-w-[560px] text-[13px] leading-relaxed text-ink-500">
              从拍照到办结，AI 负责效率，人负责判断。每个环节都有明确的输入、输出与责任边界。
            </p>
          </div>
          <Link href="/login?role=citizen" className="link-like hidden text-[13px] md:block">
            亲自走一遍 →
          </Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {FLOW.map((f) => (
            <div key={f.step} className="card card-hover relative overflow-hidden p-5">
              <div className="absolute right-3 top-3 num text-[40px] font-semibold leading-none text-ink-100">{f.step}</div>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <f.icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-[16px] font-semibold text-ink-900">{f.title}</div>
              <div className="mt-1.5 text-[12px] leading-relaxed text-ink-500">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* AI 能力 */}
      <section id="capability" className="border-y border-ink-200/70 bg-white/70 py-20">
        <div className="mx-auto max-w-[1180px] px-6">
          <div className="label text-brand-600">AI CAPABILITIES</div>
          <h2 className="mt-3 text-[30px] font-semibold tracking-tight text-ink-900">不是“识别一下”，是完整治理闭环</h2>
          <p className="mt-2 max-w-[620px] text-[13px] leading-relaxed text-ink-500">
            平台把识别、检索、编排、工具调用与人工复核组织成一条可审计的链路，而不是一个孤立的模型调用。
          </p>
          <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {CAPABILITIES.map((c) => (
              <div key={c.title} className="group card card-hover relative p-5">
                <div className="flex items-start gap-3">
                  <div
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                      c.tone === 'brand'
                        ? 'bg-brand-50 text-brand-600'
                        : c.tone === 'teal'
                          ? 'bg-teal-50 text-teal-600'
                          : c.tone === 'amber'
                            ? 'bg-amber-50 text-amber-600'
                            : c.tone === 'danger'
                              ? 'bg-danger-50 text-danger-600'
                              : 'bg-ink-100 text-ink-600'
                    }`}
                  >
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[15px] font-semibold text-ink-900">{c.title}</div>
                    <div className="mt-1 text-[12px] leading-relaxed text-ink-500">{c.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 三端入口 */}
      <section className="mx-auto max-w-[1180px] px-6 py-20">
        <div className="label text-brand-600">THREE PORTALS</div>
        <h2 className="mt-3 text-[30px] font-semibold tracking-tight text-ink-900">一个平台，三种角色视角</h2>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {PORTALS.map((p) => (
            <Link key={p.href} href={p.href} className="group relative overflow-hidden rounded-2xl p-6 text-white shadow-card transition hover:-translate-y-1">
              <div className={`absolute inset-0 bg-gradient-to-br ${p.tone}`} />
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border border-white/20" />
              <div className="absolute -bottom-16 -left-6 h-44 w-44 rounded-full border border-white/10" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px] tracking-[0.16em]">{p.tag}</div>
                  <ArrowRight className="h-4 w-4 opacity-70 transition group-hover:translate-x-1" />
                </div>
                <div className="mt-8 text-[24px] font-semibold">{p.title}</div>
                <div className="mt-1 text-[12px] text-white/70">{p.sub}</div>
                <div className="mt-4 text-[12px] leading-relaxed text-white/80">{p.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 技术亮点 */}
      <section id="tech" className="mx-auto max-w-[1180px] px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-screen-bg p-8 text-white sm:p-12">
          <div className="absolute inset-0 screen-grid opacity-60" />
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(54,229,255,.2),transparent_65%)]" />
          <div className="relative grid gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-screen-line bg-screen-panel px-3 py-1.5 text-[11px] text-screen-cyan">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-screen-cyan" />
                TECH PANEL
              </div>
              <h2 className="mt-5 text-[30px] font-semibold leading-tight">
                为评审准备的
                <br />
                四个技术切片
              </h2>
              <p className="mt-3 max-w-[420px] text-[13px] leading-relaxed text-slate-400">
                不只看界面。这里可以直接查看 Agent 的推理步骤、MCP 工具契约、AI 审计流水与安全闸门阈值。
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-[11px] text-slate-300">
                {['Agent Trace', 'MCP Tools', 'RAG Citations', 'Audit Trail', 'FSM Guard', 'SSE Stream'].map((t) => (
                  <span key={t} className="rounded-full border border-screen-line bg-screen-panel px-2.5 py-1 font-mono">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/screen', title: '指挥大屏', desc: '热力地图 · KPI · 实时事件流', icon: Activity },
                { href: '/admin/ai', title: 'AI 能力与准度', desc: '阈值 · 降级 · 采纳率 · 审计', icon: Sparkles },
                { href: '/admin/mcp', title: 'MCP 工具台', desc: '工具契约 · 在线试调用', icon: Plug },
                { href: '/admin/audit', title: 'AI 审计', desc: '模型 / 提示摘要 / 人工动作', icon: ShieldCheck }
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="group rounded-2xl border border-screen-line bg-screen-panel/80 p-4 transition hover:border-screen-cyan/40 hover:bg-screen-panel"
                >
                  <l.icon className="h-5 w-5 text-screen-cyan" />
                  <div className="mt-3 text-[14px] font-semibold text-white">{l.title}</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-slate-400">{l.desc}</div>
                  <div className="mt-3 flex items-center gap-1 text-[10px] text-screen-cyan/80">
                    查看 <ArrowRight className="h-3 w-3 opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
          <div className="relative mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-screen-line/70 bg-[#070f1c]/70 px-4 py-3 text-[11px] text-slate-400">
            <span className="font-mono text-screen-cyan/80">$ npm run dev · MOCK MODE · ZERO EXTERNAL DEPENDENCY</span>
            <span>演示账号 138 / 139 / 137 00000000 · 验证码 123456</span>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-200/70 bg-white">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-6 py-8">
          <div className="flex items-center gap-4">
            <Logo size={28} />
            <span className="text-[11px] text-ink-400">城市治理，从看见开始。</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-ink-400">
            <DemoTag />
            <span>© 2026 城事演示项目</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
