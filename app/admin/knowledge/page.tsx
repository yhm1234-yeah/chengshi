'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Database, Layers, Loader2, Power, Search, ShieldCheck } from 'lucide-react';
import { Empty } from '@/components/ui/kit';
import { toast } from '@/components/ui/toast';
import { apiGet, apiPost } from '@/lib/client';
import type { KnowledgeDoc, KnowledgeDocType } from '@/domain/types';
import { KNOWLEDGE_DOC_TYPE_META, THRESHOLDS } from '@/domain/constants';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface DocRow extends KnowledgeDoc {
  chunkCount: number;
}

const TYPE_CHIPS: { key: 'all' | KnowledgeDocType; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'responsibility', label: '职责划分' },
  { key: 'timelimit', label: '处置时限' },
  { key: 'technical', label: '技术规范' }
];

export default function KnowledgePage() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<'all' | KnowledgeDocType>('all');
  const [q, setQ] = useState('');
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<{ docs: DocRow[] }>('/api/admin/knowledge')
      .then((d) => {
        if (alive) setDocs(d.docs);
      })
      .catch((err) => {
        if (alive) toast(err instanceof Error ? err.message : '知识库加载失败', 'error');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const keyword = q.trim();
    return docs.filter((d) => {
      if (type !== 'all' && d.docType !== type) return false;
      if (keyword && !`${d.title}${d.summary}`.includes(keyword)) return false;
      return true;
    });
  }, [docs, type, q]);

  async function toggleStatus(doc: DocRow) {
    if (pending) return;
    const next = doc.status === 'active' ? 'inactive' : 'active';
    setPending(doc.id);
    try {
      const res = await apiPost<{ doc: KnowledgeDoc }>(`/api/admin/knowledge/${doc.id}/status`, { status: next });
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: res.doc.status } : d)));
      toast(next === 'active' ? '已启用该文档' : '已停用该文档', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '状态更新失败', 'error');
    } finally {
      setPending(null);
    }
  }

  const activeCount = docs.filter((d) => d.status === 'active').length;
  const chunkTotal = docs.reduce((s, d) => s + d.chunkCount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="h2 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-teal-600" /> 知识库
          </div>
          <div className="mt-1 text-[12px] text-ink-400">职责划分、处置时限与技术规范的条款级检索源，停用后不再参与 RAG。</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="num rounded-xl bg-white px-3 py-2 text-[11px] text-ink-500 shadow-soft">
            启用 {activeCount} / {docs.length}
          </span>
          <span className="num rounded-xl bg-white px-3 py-2 text-[11px] text-ink-500 shadow-soft">{chunkTotal} 条款</span>
        </div>
      </div>

      <div className="card p-4">
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: Layers, title: '条款级检索', desc: '按章节 / 条款切分，命中即引用原文' },
            { icon: Database, title: 'RRF 混合检索', desc: '关键词与向量结果融合排序' },
            { icon: ShieldCheck, title: `相似度阈值 ${THRESHOLDS.ragScore}`, desc: '低于阈值不进入引用候选' },
            { icon: Power, title: '检索不足即拒答', desc: '无可靠依据时转人工，不臆造政策' }
          ].map((item) => (
            <div key={item.title} className="rounded-xl bg-ink-50 p-3">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-700">
                <item.icon className="h-3.5 w-3.5 text-teal-600" /> {item.title}
              </div>
              <div className="mt-1 text-[10px] leading-relaxed text-ink-400">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-inset ring-ink-200 focus-within:ring-brand-400">
            <Search className="h-4 w-4 shrink-0 text-ink-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索文档标题或摘要"
              className="w-full bg-transparent text-[13px] text-ink-800 outline-none placeholder:text-ink-400"
            />
            {loading ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-500" /> : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {TYPE_CHIPS.map((t) => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[11px] transition',
                  type === t.key ? 'bg-brand-500 font-medium text-white' : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && docs.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[210px] animate-pulse rounded-2xl bg-white/70" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <Empty title="没有匹配的知识文档" desc="试试其他类型或更换搜索关键词。" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((doc) => {
            const meta = KNOWLEDGE_DOC_TYPE_META[doc.docType];
            const active = doc.status === 'active';
            return (
              <div
                key={doc.id}
                className={cn(
                  'card flex flex-col p-4 transition',
                  active ? 'card-hover' : 'border-ink-200/60 bg-ink-50/40 opacity-80'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="chip px-2 py-0.5 text-[10px]" style={{ background: meta.soft, color: meta.color }}>
                    {meta.label}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]',
                      active ? 'bg-teal-50 text-teal-700' : 'bg-ink-200 text-ink-500'
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-teal-500' : 'bg-ink-400')} />
                    {active ? '启用中' : '已停用'}
                  </span>
                </div>

                <div className="mt-2.5 line-clamp-2 text-[14px] font-semibold leading-snug text-ink-900">{doc.title}</div>

                <div className="mt-2 line-clamp-3 flex-1 text-[11px] leading-relaxed text-ink-500">{doc.summary}</div>

                <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-2.5 text-[10px] text-ink-400">
                  <span className="num">{doc.chunkCount} 条</span>
                  <span className="num">生效 {fmtDate(doc.effectiveDate)}</span>
                </div>

                <button
                  onClick={() => toggleStatus(doc)}
                  disabled={pending !== null}
                  className={cn('mt-2.5 w-full py-2 text-[12px]', active ? 'btn-ghost' : 'btn-soft')}
                >
                  {pending === doc.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Power className={cn('h-3.5 w-3.5', active ? 'text-ink-500' : 'text-brand-600')} />
                  )}
                  {active ? '停用文档' : '启用文档'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
