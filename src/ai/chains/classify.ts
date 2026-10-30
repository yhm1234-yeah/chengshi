import type { ClassifyResult, EvidenceBox, FindingDraft, ProblemType, QualityFlag, Severity } from '@/domain/types';
import { TYPE_META } from '@/domain/constants';
import { classifySchema, type ClassifyOutput } from '@/ai/schemas';
import { classifyWithVlm, hasLiveVlm, vlmModelName } from '@/ai/providers/vlm';
import { getStorage } from '@/storage';
import { hash32 } from '@/lib/utils';

const CANDIDATE_POOL: ProblemType[] = ['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07'];

interface MockCase {
  type: ProblemType;
  severity: Severity;
  confidence: number;
  findings: FindingDraft[];
  reason: string;
  qualityFlags: QualityFlag[];
}

function box(type: ProblemType, label: string, confidence: number, override?: Partial<EvidenceBox>): EvidenceBox {
  const base: Record<ProblemType, EvidenceBox> = {
    T01: { x: 0.18, y: 0.56, w: 0.24, h: 0.22, label, confidence },
    T02: { x: 0.56, y: 0.3, w: 0.3, h: 0.42, label, confidence },
    T03: { x: 0.2, y: 0.46, w: 0.44, h: 0.34, label, confidence },
    T04: { x: 0.42, y: 0.12, w: 0.2, h: 0.56, label, confidence },
    T05: { x: 0.12, y: 0.58, w: 0.64, h: 0.28, label, confidence },
    T06: { x: 0.26, y: 0.1, w: 0.44, h: 0.34, label, confidence },
    T07: { x: 0.28, y: 0.3, w: 0.44, h: 0.4, label, confidence }
  };
  return { ...base[type], ...override };
}

const CASES: Record<string, MockCase> = {
  dual: {
    type: 'T01',
    severity: 'urgent',
    confidence: 0.92,
    qualityFlags: [],
    reason:
      '画面左侧圆形井盖边缘出现放射状裂纹且井圈翘起，属井盖本体破损；右侧白色轿车跨越消防通道黄色标线停放，形成第二处独立问题。两项证据互不重叠，判定为双问题工单。',
    findings: [
      {
        type: 'T01',
        severity: 'urgent',
        confidence: 0.92,
        evidence: [box('T01', '井盖破损', 0.92)],
        desc: '井盖边缘破裂、井圈翘起，存在行人坠落风险'
      },
      {
        type: 'T02',
        severity: 'medium',
        confidence: 0.88,
        evidence: [box('T02', '违停车辆', 0.88)],
        desc: '白色轿车占用消防通道，阻碍应急车辆通行'
      }
    ]
  },
  manhole: {
    type: 'T01',
    severity: 'urgent',
    confidence: 0.95,
    qualityFlags: [],
    reason: '画面中央井盖出现贯穿裂纹，井圈与路面存在明显高差，破损特征符合 T01 判定标准。',
    findings: [
      { type: 'T01', severity: 'urgent', confidence: 0.95, evidence: [box('T01', '井盖破损', 0.95)], desc: '井盖贯穿裂纹，井圈下沉' }
    ]
  },
  parking: {
    type: 'T02',
    severity: 'medium',
    confidence: 0.91,
    qualityFlags: [],
    reason: '车辆整车停放在人行道上，车身与人行道边界线呈明显交叉，且周边无临时停靠迹象。',
    findings: [
      { type: 'T02', severity: 'medium', confidence: 0.91, evidence: [box('T02', '违停车辆', 0.91)], desc: '机动车占用人行道停放' }
    ]
  },
  garbage: {
    type: 'T03',
    severity: 'medium',
    confidence: 0.86,
    qualityFlags: [],
    reason: '垃圾成堆超出容器容量，袋装垃圾散落地面，具备长时间未清运特征。',
    findings: [
      { type: 'T03', severity: 'medium', confidence: 0.86, evidence: [box('T03', '垃圾堆积', 0.86)], desc: '生活垃圾成堆散落，未及时清运' }
    ]
  },
  streetlight: {
    type: 'T04',
    severity: 'low',
    confidence: 0.79,
    qualityFlags: [],
    reason: '路灯灯具完全熄灭，周边路面照度显著低于相邻路段，灯杆本体完好。',
    findings: [
      { type: 'T04', severity: 'low', confidence: 0.79, evidence: [box('T04', '路灯故障', 0.79)], desc: '灯具不亮，路段照度异常' }
    ]
  },
  flood: {
    type: 'T05',
    severity: 'urgent',
    confidence: 0.9,
    qualityFlags: [],
    reason: '路面积水连片，水面已覆盖路缘石，排水口位置有旋涡，符合积水内涝特征。',
    findings: [
      { type: 'T05', severity: 'urgent', confidence: 0.9, evidence: [box('T05', '路面积水', 0.9)], desc: '路面积水成片，排水口堵塞' }
    ]
  },
  billboard: {
    type: 'T06',
    severity: 'medium',
    confidence: 0.87,
    qualityFlags: [],
    reason: '广告牌面板明显倾斜，支架与立柱连接处锈蚀，存在坠落风险。',
    findings: [
      { type: 'T06', severity: 'medium', confidence: 0.87, evidence: [box('T06', '广告牌松动', 0.87)], desc: '广告牌倾斜、支架锈蚀' }
    ]
  },
  lowconfidence: {
    type: 'T03',
    severity: 'medium',
    confidence: 0.62,
    qualityFlags: ['blur', 'occluded'],
    reason: '画面存在运动模糊，主体被前景遮挡，可判断为垃圾堆积但边界不清，置信度低于闸门阈值。',
    findings: [
      { type: 'T03', severity: 'medium', confidence: 0.62, evidence: [box('T03', '疑似垃圾堆积', 0.62)], desc: '疑似垃圾堆积，画面模糊' }
    ]
  }
};

function detectCase(imageUrls: string[], demoCase?: string): string {
  if (demoCase && CASES[demoCase]) return demoCase;
  const joined = imageUrls.join(' ').toLowerCase();
  if (joined.includes('dual')) return 'dual';
  if (joined.includes('manhole') || joined.includes('t01')) return 'manhole';
  if (joined.includes('parking') || joined.includes('t02')) return 'parking';
  if (joined.includes('garbage') || joined.includes('t03')) return 'garbage';
  if (joined.includes('streetlight') || joined.includes('t04')) return 'streetlight';
  if (joined.includes('flood') || joined.includes('t05')) return 'flood';
  if (joined.includes('billboard') || joined.includes('t06')) return 'billboard';
  return 'lowconfidence';
}

function candidatesFor(type: ProblemType, confidence: number): ClassifyResult['candidates'] {
  const scores: Record<ProblemType, number> = {
    T01: 0,
    T02: 0,
    T03: 0,
    T04: 0,
    T05: 0,
    T06: 0,
    T07: 0
  };
  scores[type] = confidence;
  CANDIDATE_POOL.filter((t) => t !== type).forEach((t, i) => {
    scores[t] = Number(Math.max(0.08, 0.2 - i * 0.05).toFixed(2));
  });
  return CANDIDATE_POOL.map((t) => ({ type: t, label: TYPE_META[t].label, score: scores[t] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function mockResult(caseKey: string, degraded = false): ClassifyResult {
  const c = CASES[caseKey] ?? CASES.lowconfidence;
  const confidence = degraded ? Math.min(0.6, c.confidence) : c.confidence;
  return {
    type: c.type,
    severity: c.severity,
    confidence,
    evidence: c.findings[0]?.evidence ?? [],
    qualityFlags: degraded ? (['no_subject'] as QualityFlag[]) : c.qualityFlags,
    findings: c.findings.map((f) => ({ ...f, confidence: Math.min(f.confidence, confidence + 0.05) })),
    candidates: confidence < 0.75 || degraded ? candidatesFor(c.type, confidence) : [],
    degraded,
    reason: degraded ? '视觉模型不可用，已降级为示例识别结果，建议人工确认类型。' : c.reason,
    model: degraded ? 'manual-fallback' : `${vlmModelName()} (mock)`,
    latencyMs: 0
  };
}

function toResult(output: ClassifyOutput, model: string, latencyMs: number): ClassifyResult {
  const findings = output.findings.map((f) => ({
    type: f.type,
    severity: f.severity,
    confidence: f.confidence,
    evidence: f.evidence,
    desc: f.desc
  }));
  const confidence = output.confidence;
  return {
    type: output.type,
    severity: output.severity,
    confidence,
    evidence: output.evidence,
    qualityFlags: output.quality_flags,
    findings: findings.length ? findings : [{ type: output.type, severity: output.severity, confidence, evidence: output.evidence, desc: output.reason }],
    candidates: confidence < 0.75 ? candidatesFor(output.type, confidence) : [],
    degraded: false,
    reason: output.reason,
    model,
    latencyMs
  };
}

/** 识别链：mock 与真实模型共用同一入口，仅 provider 不同；每次调用必写 ai_runs */
export async function runClassify(options: {
  imageUrls: string[];
  demoCase?: string;
  hint?: string;
  ticketId?: string | null;
}): Promise<ClassifyResult> {
  const started = Date.now();
  let result: ClassifyResult;
  let fallbackUsed = false;

  if (hasLiveVlm()) {
    try {
      const live = await classifyWithVlm(options.imageUrls, classifySchema, options.hint);
      result = toResult(live.output, live.model, live.latencyMs);
      fallbackUsed = live.fallbackUsed;
    } catch {
      result = mockResult(detectCase(options.imageUrls, options.demoCase), true);
      fallbackUsed = true;
    }
  } else {
    result = mockResult(detectCase(options.imageUrls, options.demoCase));
  }

  const latencyMs = result.latencyMs || Date.now() - started + 900 + (hash32(options.imageUrls.join('')) % 500);
  result.latencyMs = latencyMs;

  const run = getStorage().ai.createRun({
    ticketId: options.ticketId ?? null,
    stage: 'classify',
    model: result.model,
    modelVersion: result.degraded ? 'fallback' : '2026.10',
    promptDigest: `sha256:${hash32('classify:' + options.imageUrls.join(',').slice(0, 40)).toString(16)}`,
    inputDigest: `images=${options.imageUrls.length};case=${options.demoCase ?? 'auto'}`,
    outputJson: {
      type: result.type,
      severity: result.severity,
      confidence: result.confidence,
      findings: result.findings,
      evidence: result.evidence,
      quality_flags: result.qualityFlags,
      candidates: result.candidates
    },
    tokensIn: 760,
    tokensOut: 180,
    latencyMs,
    fallbackUsed,
    degraded: result.degraded
  });
  result.runId = run.id;
  return result;
}
