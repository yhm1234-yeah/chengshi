'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Loader2, MessageCircleHeart, ShieldCheck, Sparkles } from 'lucide-react';
import { StatusBadge, TypeBadge } from '@/components/ui/kit';
import { streamPost } from '@/lib/client';
import type { ChatCitation, ChatResult, ChatTicketCard } from '@/domain/types';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  citations?: ChatCitation[];
  tickets?: ChatTicketCard[];
  grounded?: boolean;
  fallback?: boolean;
  streaming?: boolean;
}

const SUGGESTIONS = ['我的工单到哪一步了？', '井盖坏了该找谁负责？', '紧急工单多久必须办结？', '工单超时了怎么督办？'];

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  text: '您好，我是「城事」办理助手。\n我可以帮您查询工单进度、说明责任部门与处置时限。\n回答只基于工单数据与知识库条款，没有依据时我会直接说明。',
  grounded: true
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput('');
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text: content };
    const botId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, { id: botId, role: 'assistant', text: '', streaming: true }]);
    setBusy(true);

    const patch = (fn: (m: Message) => Message) => setMessages((prev) => prev.map((m) => (m.id === botId ? fn(m) : m)));

    abortRef.current = await streamPost(
      '/api/ai/chat',
      { message: content },
      (msg) => {
        if (msg.event === 'delta') patch((m) => ({ ...m, text: m.text + String(msg.data.text ?? '') }));
        else if (msg.event === 'citations')
          patch((m) => ({ ...m, citations: msg.data.citations as ChatCitation[], grounded: Boolean(msg.data.grounded) }));
        else if (msg.event === 'tickets') patch((m) => ({ ...m, tickets: msg.data.tickets as ChatTicketCard[] }));
        else if (msg.event === 'done') {
          const result = msg.data.result as ChatResult | undefined;
          if (result) patch((m) => ({ ...m, text: result.answer, citations: result.citations, tickets: result.tickets, grounded: result.grounded, fallback: result.fallback, streaming: false }));
        }
      },
      () => {
        patch((m) => ({ ...m, streaming: false }));
        setBusy(false);
      }
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-200/60 bg-white/95 px-5 pb-3 pt-4 backdrop-blur">
        <div>
          <div className="flex items-center gap-1.5 text-[17px] font-semibold text-ink-900">
            <MessageCircleHeart className="h-4 w-4 text-brand-500" /> 办理助手
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-ink-400">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" /> RAG 知识库已连接 · 无依据不作答
          </div>
        </div>
        <Link href="/m/tickets" className="text-[11px] text-brand-600">我的工单</Link>
      </div>

      <div ref={scrollRef} className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[88%]', m.role === 'user' ? 'text-right' : '')}>
              <div
                className={cn(
                  'inline-block whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-left text-[12px] leading-relaxed',
                  m.role === 'user'
                    ? 'bg-brand-500 text-white'
                    : 'border border-ink-200/60 bg-white text-ink-700 shadow-soft'
                )}
              >
                {m.text || (m.streaming ? '思考中…' : '')}
                {m.streaming ? <span className="ml-0.5 inline-block h-3 w-1 animate-breathe bg-brand-400 align-middle" /> : null}
              </div>

              {m.tickets?.length ? (
                <div className="mt-2 space-y-1.5">
                  {m.tickets.map((t) => (
                    <Link
                      key={t.code}
                      href={`/m/tickets/${t.code}`}
                      className="block rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="num text-[9px] text-ink-400">{t.code}</span>
                        <StatusBadge status={t.status} size="sm" />
                      </div>
                      <div className="mt-1 text-[11px] font-medium text-ink-800">{t.title}</div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <TypeBadge type={t.type} size="sm" />
                        <span className="text-[9px] text-ink-400">查看详情 →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : null}

              {m.citations?.length ? (
                <div className="mt-2 space-y-1">
                  {m.citations.slice(0, 3).map((c, i) => (
                    <div key={`${c.docTitle}-${c.clause}-${i}`} className="rounded-lg border border-teal-200/70 bg-teal-50/60 px-2.5 py-1.5 text-left">
                      <div className="text-[9px] text-teal-700">
                        引用 {i + 1} ·《{c.docTitle.replace(/《|》/g, '')}》{c.clause}
                        <span className="num ml-1 opacity-60">{c.score}</span>
                      </div>
                      <div className="mt-0.5 text-[9px] leading-relaxed text-ink-500">{c.snippet}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              {m.fallback ? (
                <div className="mt-1.5 flex items-center gap-1 text-[9px] text-amber-600">
                  <ShieldCheck className="h-3 w-3" /> 知识库证据不足，已拒答，避免误导
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-ink-200/60 bg-white px-4 pb-3 pt-2.5">
        <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={busy}
              className="shrink-0 rounded-full bg-ink-100 px-2.5 py-1.5 text-[10px] text-ink-500 transition active:scale-95 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-ink-100 px-3 py-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-500" />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 300))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder="问问工单进度、责任部门或处置时限…"
              className="max-h-[76px] w-full resize-none bg-transparent text-[12px] leading-relaxed text-ink-700 outline-none placeholder:text-ink-400"
            />
          </div>
          <button
            onClick={() => send()}
            disabled={busy || !input.trim()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 text-white transition active:scale-95 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-1.5 text-center text-[9px] text-ink-300">演示环境 · 回答由规则与知识库生成，非真实政务答复</div>
      </div>
    </div>
  );
}
