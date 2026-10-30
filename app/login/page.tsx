'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, MessageSquareText, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';
import { Logo, DemoTag } from '@/components/ui/kit';
import { apiPost } from '@/lib/client';
import { toast } from '@/components/ui/toast';
import { DEMO_ACCOUNTS } from '@/domain/constants';
import type { Role } from '@/domain/types';

const ROLE_TABS: { key: Role; label: string; sub: string }[] = [
  { key: 'citizen', label: '市民端', sub: '随手拍 · 查进度 · 评价' },
  { key: 'staff', label: '网格坐席', sub: '复核 · 改派 · 督办' },
  { key: 'command', label: '指挥中心', sub: '大屏 · 考核 · 知识库' }
];

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-[12px] text-ink-400">加载中…</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '';
  const initialRole = (params.get('role') as Role) || 'citizen';
  const [role, setRole] = useState<Role>(ROLE_TABS.some((t) => t.key === initialRole) ? initialRole : 'citizen');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState('');

  const demo = useMemo(() => DEMO_ACCOUNTS.find((a) => a.role === role) ?? DEMO_ACCOUNTS[0], [role]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    setPhone(demo.phone);
    setCode('');
    setHint('');
  }, [demo]);

  const targetPath = () => {
    if (next) return next;
    if (role === 'citizen') return '/m';
    return '/admin';
  };

  async function sendCode() {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      toast('请输入正确的 11 位手机号', 'error');
      return;
    }
    setSending(true);
    try {
      const res = await apiPost<{ devCode: string; ttl: number }>('/api/auth/code', { phone });
      setCountdown(60);
      setHint(`演示验证码：${res.devCode}（60 秒内有效，可重复使用）`);
      setCode(res.devCode);
      toast('验证码已发送', 'success', '演示环境直接使用 123456');
    } catch (err) {
      toast(err instanceof Error ? err.message : '发送失败', 'error');
    } finally {
      setSending(false);
    }
  }

  async function login() {
    if (!/^1[3-9]\d{9}$/.test(phone)) return toast('请输入正确的手机号', 'error');
    if (!/^\d{6}$/.test(code)) return toast('请输入 6 位验证码', 'error');
    setLoading(true);
    try {
      await apiPost('/api/auth/login', { phone, code, role });
      toast('登录成功', 'success', role === 'citizen' ? '欢迎回到「城事」' : '已进入管理端');
      router.push(targetPath());
    } catch (err) {
      toast(err instanceof Error ? err.message : '登录失败', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function demoLogin(key: Role) {
    const account = DEMO_ACCOUNTS.find((a) => a.role === key);
    if (!account) return;
    setLoading(true);
    try {
      await apiPost('/api/auth/login', { phone: account.phone, code: account.code, role: key });
      router.push(key === 'citizen' ? '/m' : '/admin');
    } catch (err) {
      toast(err instanceof Error ? err.message : '登录失败', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F7F8FC]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-0 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(76,93,240,.18),transparent_62%)]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(18,163,143,.14),transparent_62%)]" />
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(16,24,40,.12)_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-[1120px] flex-col px-5 py-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[12px] text-ink-500 transition hover:text-ink-900">
            <ArrowLeft className="h-4 w-4" /> 返回首页
          </Link>
          <DemoTag />
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="grid w-full items-center gap-10 lg:grid-cols-[.9fr_1.1fr]">
            {/* 左：品牌说明 */}
            <div className="hidden lg:block">
              <Logo size={42} />
              <h1 className="mt-8 text-[38px] font-semibold leading-[1.16] tracking-tight text-ink-900">
                登录之后，
                <br />
                <span className="bg-gradient-to-r from-brand-600 to-teal-500 bg-clip-text text-transparent">看见城市的回答</span>
              </h1>
              <p className="mt-4 max-w-[400px] text-[13px] leading-relaxed text-ink-500">
                三个入口，一套数据。市民、坐席与指挥中心共享同一条工单链路，
                AI 的每一个判断都可回溯、可复核、可问责。
              </p>

              <div className="mt-9 space-y-3">
                {[
                  { icon: Smartphone, title: '市民端', desc: '拍照上报 5 步完成，识别结果实时可见' },
                  { icon: ShieldCheck, title: '管理端', desc: '坐席复核、改派、督办与知识库维护' },
                  { icon: Sparkles, title: '技术面板', desc: 'Agent 轨迹、MCP 工具与 AI 审计流水' }
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/70 p-3.5 shadow-soft backdrop-blur">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-ink-900">{item.title}</div>
                      <div className="mt-0.5 text-[11px] text-ink-500">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-2xl bg-screen-bg p-4 text-white">
                <div className="flex items-center gap-2 text-[11px] text-screen-cyan">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-screen-cyan" />
                  DEMO NOTE
                </div>
                <div className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  本系统为参赛演示版本，所有工单、地址、部门与制度均为虚构数据，不对接任何真实政务系统。
                </div>
              </div>
            </div>

            {/* 右：表单 */}
            <div className="mx-auto w-full max-w-[440px]">
              <div className="rounded-3xl border border-white/80 bg-white/85 p-6 shadow-card backdrop-blur-xl sm:p-8">
                <div className="lg:hidden">
                  <Logo size={32} />
                </div>
                <div className="mt-6 text-[24px] font-semibold tracking-tight text-ink-900 lg:mt-0">进入「城事」</div>
                <div className="mt-1 text-[12px] text-ink-400">选择身份，演示账号已验证码直通</div>

                <div className="mt-5 grid grid-cols-3 gap-1.5 rounded-2xl bg-ink-100 p-1">
                  {ROLE_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setRole(tab.key)}
                      className={`rounded-xl px-2 py-2.5 text-center transition ${
                        role === tab.key ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'
                      }`}
                    >
                      <div className="text-[12px] font-semibold">{tab.label}</div>
                      <div className="mt-0.5 text-[9px] opacity-60">{tab.sub}</div>
                    </button>
                  ))}
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-[11px] text-ink-500">
                      <span>手机号</span>
                      <span className="font-mono text-ink-300">DEMO {demo.phone}</span>
                    </div>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="请输入 11 位手机号"
                      inputMode="numeric"
                      className="field"
                    />
                  </div>

                  <div>
                    <div className="mb-1.5 text-[11px] text-ink-500">验证码</div>
                    <div className="flex gap-2">
                      <input
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6 位验证码"
                        inputMode="numeric"
                        className="field flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') login();
                        }}
                      />
                      <button onClick={sendCode} disabled={countdown > 0 || sending} className="btn-ghost shrink-0 px-4">
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : countdown > 0 ? `${countdown}s` : '获取验证码'}
                      </button>
                    </div>
                    {hint ? <div className="mt-2 text-[11px] text-brand-600">{hint}</div> : null}
                  </div>

                  <button onClick={login} disabled={loading} className="btn-primary w-full py-3">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {loading ? '登录中…' : '登录'}
                    {!loading ? <ArrowRight className="h-4 w-4" /> : null}
                  </button>
                </div>

                <div className="my-5 flex items-center gap-3 text-[10px] text-ink-300">
                  <div className="divider" />
                  或使用演示身份
                  <div className="divider" />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {DEMO_ACCOUNTS.map((a) => (
                    <button
                      key={a.role}
                      onClick={() => demoLogin(a.role)}
                      disabled={loading}
                      className="rounded-xl border border-ink-200 bg-white px-2 py-2.5 text-[11px] font-medium text-ink-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                    >
                      {a.role === 'citizen' ? '市民' : a.role === 'staff' ? '坐席' : '指挥'}
                    </button>
                  ))}
                </div>

                <div className="mt-5 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-700">
                  <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  演示环境：验证码固定为 123456；真实环境将接入运营商短信并启用 60 秒防刷与 5 次锁定策略。
                </div>
              </div>

              <div className="mt-4 text-center text-[10px] text-ink-400">
                登录即表示同意《演示使用说明》，本系统不采集真实个人信息。
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
