// 隐私闸门：手机号 / 身份证 / 银行卡检测与脱敏
export interface SensitiveHit {
  type: 'phone' | 'idcard' | 'bankcard';
  label: string;
  start: number;
  end: number;
  raw: string;
  masked: string;
}

const PATTERNS: { type: SensitiveHit['type']; label: string; re: RegExp; mask: (s: string) => string }[] = [
  {
    type: 'phone',
    label: '手机号',
    re: /1[3-9]\d{9}/g,
    mask: (s) => `${s.slice(0, 3)}****${s.slice(7)}`
  },
  {
    type: 'idcard',
    label: '身份证号',
    re: /\d{17}[\dXx]/g,
    mask: (s) => `${s.slice(0, 6)}********${s.slice(14)}`
  },
  {
    type: 'bankcard',
    label: '银行卡号',
    re: /\b\d{16,19}\b/g,
    mask: (s) => `${s.slice(0, 4)} **** **** ${s.slice(-4)}`
  }
];

export function detectSensitive(text: string): SensitiveHit[] {
  const hits: SensitiveHit[] = [];
  for (const p of PATTERNS) {
    const re = new RegExp(p.re.source, 'g');
    let m: RegExpExecArray | null = re.exec(text);
    while (m) {
      hits.push({
        type: p.type,
        label: p.label,
        start: m.index,
        end: m.index + m[0].length,
        raw: m[0],
        masked: p.mask(m[0])
      });
      m = re.exec(text);
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

export function maskSensitive(text: string): string {
  let out = text;
  for (const hit of detectSensitive(text).sort((a, b) => b.start - a.start)) {
    out = out.slice(0, hit.start) + hit.masked + out.slice(hit.end);
  }
  return out;
}

export function maskPhone(phone: string): string {
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}
