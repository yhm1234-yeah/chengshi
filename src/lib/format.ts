// 时间与工单号格式化：统一 Asia/Shanghai，禁止裸 toLocaleString
const TZ = 'Asia/Shanghai';

const dateTimeFmt = new Intl.DateTimeFormat('zh-CN', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const clockFmt = new Intl.DateTimeFormat('zh-CN', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});

export function fmtDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso)).replace(/\//g, '-');
}

export function fmtDate(iso: string): string {
  return dateFmt.format(new Date(iso)).replace(/\//g, '-');
}

export function fmtClock(iso: string): string {
  return clockFmt.format(new Date(iso));
}

export function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return fmtDate(iso);
}

export function hoursBetween(from: string, to: string): number {
  return Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / 3600000);
}

export function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} 分钟`;
  if (h < 24) return `${h.toFixed(1)} 小时`;
  return `${(h / 24).toFixed(1)} 天`;
}

export function ymd(iso: string): string {
  return fmtDate(iso).replace(/-/g, '');
}

/** 工单号：CS + 日期 + 四位流水，例如 CS20261118-0042 */
export function makeTicketCode(seq: number, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
    .format(at)
    .split('-');
  return `CS${parts[0]}${parts[1]}${parts[2]}-${String(seq % 10000).padStart(4, '0')}`;
}

export function isoDaysAgo(days: number, hourOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() + hourOffset);
  return d.toISOString();
}
