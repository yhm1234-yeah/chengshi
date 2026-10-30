import { cn } from '@/lib/utils';
import type { ProblemType, Severity, TicketStatus } from '@/domain/types';
import { SEVERITY_META, STATUS_META, TYPE_META } from '@/domain/constants';
import { DISCLAIMER } from '@/domain/constants';

export function Logo({ size = 34, dark = false, withText = true }: { size?: number; dark?: boolean; withText?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
        <defs>
          <linearGradient id="lg-brand" x1="4" y1="4" x2="36" y2="36">
            <stop stopColor={dark ? '#36E5FF' : '#4C5DF0'} />
            <stop offset="1" stopColor={dark ? '#4D7CFF' : '#12A38F'} />
          </linearGradient>
        </defs>
        <circle cx="20" cy="20" r="18" stroke="url(#lg-brand)" strokeWidth="1.4" opacity="0.35" />
        <circle cx="20" cy="20" r="13" stroke="url(#lg-brand)" strokeWidth="1.2" opacity="0.6" />
        <path d="M20 8.5c-4.6 0-8.3 3.6-8.3 8.1 0 5.7 8.3 13.4 8.3 13.4s8.3-7.7 8.3-13.4c0-4.5-3.7-8.1-8.3-8.1Z" fill="url(#lg-brand)" opacity="0.92" />
        <path d="M15.5 22.5h9M17 19.5h6M18.6 16.6h2.8" stroke={dark ? '#04070F' : '#fff'} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="20" cy="16.4" r="1.6" fill={dark ? '#04070F' : '#fff'} />
      </svg>
      {withText ? (
        <div className="leading-none">
          <div className={cn('text-[17px] font-semibold tracking-[0.12em]', dark ? 'text-white' : 'text-ink-900')}>城事</div>
          <div className={cn('mt-1 text-[9px] font-medium uppercase tracking-[0.22em]', dark ? 'text-screen-cyan/70' : 'text-ink-400')}>
            CHENGSHI · AI CITY
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DemoTag({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
        dark ? 'border-screen-line bg-screen-panel text-screen-cyan/80' : 'border-amber-200 bg-amber-50 text-amber-700',
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dark ? 'bg-screen-cyan' : 'bg-amber-500')} />
      {DISCLAIMER}
    </span>
  );
}

export function TypeBadge({ type, size = 'md' }: { type: ProblemType; size?: 'sm' | 'md' }) {
  const meta = TYPE_META[type];
  return (
    <span
      className={cn('chip', size === 'sm' ? 'px-2 py-0.5 text-[11px]' : '')}
      style={{ background: meta.soft, color: meta.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

export function SeverityBadge({ severity, size = 'md' }: { severity: Severity; size?: 'sm' | 'md' }) {
  const meta = SEVERITY_META[severity];
  return (
    <span
      className={cn('chip', size === 'sm' ? 'px-2 py-0.5 text-[11px]' : '')}
      style={{ background: meta.soft, color: meta.color }}
    >
      {severity === 'urgent' ? '● ' : ''}
      {meta.label}
    </span>
  );
}

export function StatusBadge({ status, size = 'md' }: { status: TicketStatus; size?: 'sm' | 'md' }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn('chip', size === 'sm' ? 'px-2 py-0.5 text-[11px]' : '')}
      style={{ background: meta.soft, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

export function Stat({
  label,
  value,
  unit,
  hint,
  tone = 'brand',
  icon
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  tone?: 'brand' | 'teal' | 'amber' | 'danger' | 'ink';
  icon?: React.ReactNode;
}) {
  const toneMap = {
    brand: 'text-brand-600 bg-brand-50',
    teal: 'text-teal-600 bg-teal-50',
    amber: 'text-amber-600 bg-amber-50',
    danger: 'text-danger-600 bg-danger-50',
    ink: 'text-ink-700 bg-ink-100'
  };
  return (
    <div className="card card-hover p-4">
      <div className="flex items-start justify-between">
        <div className="text-[12px] font-medium text-ink-500">{label}</div>
        {icon ? <div className={cn('grid h-7 w-7 place-items-center rounded-lg', toneMap[tone])}>{icon}</div> : null}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="num text-[28px] font-semibold leading-none text-ink-900">{value}</span>
        {unit ? <span className="text-[12px] text-ink-400">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-2 text-[11px] text-ink-400">{hint}</div> : null}
    </div>
  );
}

export function SectionTitle({
  title,
  desc,
  action,
  className
}: {
  title: React.ReactNode;
  desc?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-end justify-between gap-4', className)}>
      <div>
        <div className="h3">{title}</div>
        {desc ? <div className="mt-1 text-[12px] text-ink-400">{desc}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function Empty({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-100 text-ink-300">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 7h16M4 12h10M4 17h7" opacity=".6" />
          <circle cx="19" cy="17" r="3" />
          <path d="M21.2 19.2 23 21" />
        </svg>
      </div>
      <div className="text-[14px] font-medium text-ink-700">{title}</div>
      {desc ? <div className="max-w-sm text-[12px] leading-relaxed text-ink-400">{desc}</div> : null}
      {action}
    </div>
  );
}

export function ConfidenceBar({ value, showLabel = true }: { value: number; showLabel?: boolean }) {
  const color = value >= 0.75 ? '#12A38F' : value >= 0.5 ? '#F59300' : '#F04438';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-200">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(4, value * 100)}%`, background: color }} />
      </div>
      {showLabel ? <span className="num w-9 text-right text-[11px] text-ink-500">{Math.round(value * 100)}%</span> : null}
    </div>
  );
}

export function StatusFlow({ status, compact = false }: { status: TicketStatus; compact?: boolean }) {
  const steps: { key: string; label: string }[] = [
    { key: 'submitted', label: '提交' },
    { key: 'ai', label: 'AI 识别' },
    { key: 'dispatch', label: 'AI 分派' },
    { key: 'review', label: '人工复核' },
    { key: 'process', label: '处置中' },
    { key: 'closed', label: '办结' },
    { key: 'rated', label: '评价' }
  ];
  const map: Record<TicketStatus, number> = {
    submitted: 0,
    ai_filed: 1,
    pending_review: 3,
    assigned: 4,
    processing: 4,
    closed: 5,
    rated: 6,
    reopened: 5
  };
  const index = map[status];
  return (
    <div className={cn('flex items-center', compact ? 'gap-1' : 'gap-0')}>
      {steps.map((s, i) => {
        const done = i <= index;
        const current = i === index;
        return (
          <div key={s.key} className="flex flex-1 items-center gap-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'grid place-items-center rounded-full border text-[10px] transition',
                  compact ? 'h-2 w-2' : 'h-5 w-5',
                  done ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-200 bg-white text-ink-300',
                  current && 'ring-4 ring-brand-500/15'
                )}
              >
                {compact ? null : done ? '✓' : i + 1}
              </div>
              {compact ? null : <span className={cn('whitespace-nowrap text-[10px]', done ? 'text-ink-600' : 'text-ink-300')}>{s.label}</span>}
            </div>
            {!compact && i < steps.length - 1 ? (
              <div className={cn('mb-4 h-[2px] flex-1 rounded-full', i < index ? 'bg-brand-500' : 'bg-ink-200')} />
            ) : null}
            {compact && i < steps.length - 1 ? <div className={cn('h-1 w-2 rounded-full', i < index ? 'bg-brand-400' : 'bg-ink-200')} /> : null}
          </div>
        );
      })}
    </div>
  );
}

export function Avatar({ name, size = 34, tone = 'brand' }: { name: string; size?: number; tone?: 'brand' | 'ink' | 'teal' | 'screen' }) {
  const colors = {
    brand: 'from-brand-500 to-brand-700',
    ink: 'from-ink-600 to-ink-900',
    teal: 'from-teal-400 to-teal-600',
    screen: 'from-screen-cyan to-screen-blue'
  };
  return (
    <div
      className={cn('grid shrink-0 place-items-center rounded-full bg-gradient-to-br text-white', colors[tone])}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {name.slice(0, 1)}
    </div>
  );
}

export function KeyValue({ items, cols = 2 }: { items: { k: string; v: React.ReactNode }[]; cols?: number }) {
  return (
    <div className={cn('grid gap-x-4 gap-y-3', cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : 'grid-cols-1')}>
      {items.map((item) => (
        <div key={item.k}>
          <div className="text-[11px] text-ink-400">{item.k}</div>
          <div className="mt-1 text-[13px] font-medium text-ink-800">{item.v}</div>
        </div>
      ))}
    </div>
  );
}
