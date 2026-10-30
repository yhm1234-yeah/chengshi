'use client';

import type { EvidenceBox, QualityFlag } from '@/domain/types';
import { cn } from '@/lib/utils';

const FLAG_TEXT: Record<QualityFlag, string> = {
  blur: '画面模糊',
  backlight: '逆光',
  no_subject: '主体不明显',
  occluded: '遮挡'
};

export function EvidencePhoto({
  src,
  alt,
  boxes = [],
  scanning = false,
  qualityFlags = [],
  className,
  onBoxClick
}: {
  src: string;
  alt: string;
  boxes?: EvidenceBox[];
  scanning?: boolean;
  qualityFlags?: QualityFlag[];
  className?: string;
  onBoxClick?: (index: number, box: EvidenceBox) => void;
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-ink-900', className)}>
      <img src={src} alt={alt} className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/5" />

      {boxes.map((box, i) => {
        const conf = box.confidence ?? 0;
        const color = conf >= 0.75 ? '#36E5FF' : conf >= 0.5 ? '#FFC24D' : '#FF7070';
        return (
          <button
            key={`${box.label}-${i}`}
            onClick={() => onBoxClick?.(i, box)}
            className="absolute rounded-[4px] border-2 text-left transition hover:bg-white/5"
            style={{
              left: `${box.x * 100}%`,
              top: `${box.y * 100}%`,
              width: `${box.w * 100}%`,
              height: `${box.h * 100}%`,
              borderColor: color,
              boxShadow: `0 0 0 1px rgba(0,0,0,.25), 0 0 18px ${color}55`
            }}
          >
            <span
              className="absolute -top-[18px] left-0 whitespace-nowrap rounded-sm px-1.5 py-[2px] text-[9px] font-semibold leading-none text-screen-bg"
              style={{ background: color }}
            >
              {box.label}
              {conf ? ` · ${Math.round(conf * 100)}%` : ''}
            </span>
            <span className="absolute -right-[3px] -bottom-[3px] h-1.5 w-1.5 rounded-full" style={{ background: color }} />
            <span className="absolute -left-[3px] -bottom-[3px] h-1.5 w-1.5 rounded-full" style={{ background: color }} />
            <span className="absolute -right-[3px] -top-[3px] h-1.5 w-1.5 rounded-full" style={{ background: color }} />
            <span className="absolute -left-[3px] -top-[3px] h-1.5 w-1.5 rounded-full" style={{ background: color }} />
          </button>
        );
      })}

      {scanning ? (
        <div className="scan-wrap pointer-events-none absolute inset-0">
          <div className="scan-line animate-scan" />
        </div>
      ) : null}

      {scanning ? (
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[10px] text-white backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-screen-cyan" />
          识别中
        </div>
      ) : null}

      {qualityFlags.length ? (
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
          {qualityFlags.map((f) => (
            <span key={f} className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-medium text-white">
              {FLAG_TEXT[f] ?? f}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
