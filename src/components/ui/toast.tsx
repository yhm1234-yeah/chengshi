'use client';

import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  desc?: string;
}

const globalToast = globalThis as unknown as { __csToasts?: ToastItem[]; __csToastListeners?: Set<(t: ToastItem[]) => void> };

function emit() {
  const listeners = globalToast.__csToastListeners;
  if (!listeners) return;
  const list = [...(globalToast.__csToasts ?? [])];
  listeners.forEach((fn) => fn(list));
}

export function toast(title: string, kind: ToastKind = 'success', desc?: string) {
  const id = Date.now() + Math.random();
  globalToast.__csToasts = [...(globalToast.__csToasts ?? []), { id, kind, title, desc }].slice(-3);
  emit();
  setTimeout(() => {
    globalToast.__csToasts = (globalToast.__csToasts ?? []).filter((t) => t.id !== id);
    emit();
  }, 3200);
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    globalToast.__csToastListeners ||= new Set();
    const listener = (list: ToastItem[]) => setItems(list);
    globalToast.__csToastListeners.add(listener);
    return () => {
      globalToast.__csToastListeners?.delete(listener);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed left-1/2 top-5 z-[999] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-2xl border p-3.5 shadow-float animate-rise backdrop-blur',
            item.kind === 'success' && 'border-teal-200 bg-teal-50/90 text-teal-800',
            item.kind === 'error' && 'border-danger-200 bg-danger-50/90 text-danger-700',
            item.kind === 'info' && 'border-brand-200 bg-brand-50/90 text-brand-800'
          )}
        >
          {item.kind === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : item.kind === 'error' ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold">{item.title}</div>
            {item.desc ? <div className="mt-0.5 text-[12px] opacity-75">{item.desc}</div> : null}
          </div>
          <button
            onClick={() => {
              globalToast.__csToasts = (globalToast.__csToasts ?? []).filter((t) => t.id !== item.id);
              emit();
            }}
            className="opacity-50 transition hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
