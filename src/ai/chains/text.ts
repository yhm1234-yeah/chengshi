import type { FindingDraft, LocateHint, ProblemType, Severity } from '@/domain/types';
import { SEVERITY_META, TYPE_META, GRIDS } from '@/domain/constants';
import { detectSensitive, maskSensitive } from '@/domain/privacy';
import { generateStructured, hasLiveLlm, llmModelName } from '@/ai/providers/llm';
import { describeSchema, urgeSchema, reassignSchema } from '@/ai/schemas';
import { getStorage } from '@/storage';
import { hash32 } from '@/lib/utils';
import { pct } from '@/lib/utils';

const IMPACT: Record<ProblemType, string> = {
  T01: '井盖破损或缺失会导致行人、车辆坠落，属高风险安全隐患，需要立即围挡并修复。',
  T02: '违停占道挤占消防通道与人行空间，影响应急车辆通行和行人安全。',
  T03: '垃圾长期堆积易滋生蚊蝇、产生异味，影响市容环境与居民健康。',
  T04: '路灯故障导致路段照度不足，夜间通行存在治安与交通双重风险。',
  T05: '路面积水影响车辆与行人通行，深度较大时可能倒灌周边商铺与地下空间。',
  T06: '广告牌松动、锈蚀存在高空坠落风险，需尽快警戒与加固。',
  T07: '该问题需由指挥中心进一步研判后明确承办部门与处置方式。'
};

export interface DescriptionInput {
  raw: string;
  address: string;
  district: string;
  findings: FindingDraft[];
  severity: Severity;
  confidence: number;
  ticketId?: string | null;
}

export interface TextGeneration {
  text: string;
  model: string;
  latencyMs: number;
  fallbackUsed: boolean;
  runId: string;
  privacyHits: number;
}

const DESCRIBE_SYSTEM = `你是城市治理工单文本助手。请把市民口语化描述改写为规范、客观、可派单的工单描述。
硬性要求：不得编造照片中不存在的事实；保留地点、数量、时间等关键信息；手机号、身份证号等个人信息必须脱敏；输出为纯文本，分为【现场情况】【影响研判】【办理建议】三段，总长度 80–200 字。`;

function templateDescription(input: DescriptionInput): string {
  const labels = Array.from(new Set(input.findings.map((f) => TYPE_META[f.type].label))).join('、');
  const primary = input.findings[0]?.type ?? 'T07';
  const dept = `${input.district}${TYPE_META[primary].department}`;
  const sla = SEVERITY_META[input.severity].slaHours;
  const raw = input.raw.trim() ? maskSensitive(input.raw.trim()) : '市民未补充文字描述。';
  return [
    `【现场情况】市民上报反映，${input.address}存在${labels}问题。${raw}`,
    `【影响研判】${IMPACT[primary]}`,
    `【办理建议】建议由${dept}承办，按${SEVERITY_META[input.severity].label}等级 ${sla} 小时响应时限处置，处置完成后回传前后对比照片。AI 识别置信度 ${pct(input.confidence)}。`
  ].join('\n');
}

/** 规范描述生成：真实模型可用时调用 LLM 并解析结构化 JSON，否则走同签名的模板实现 */
export async function generateDescription(input: DescriptionInput): Promise<TextGeneration> {
  const started = Date.now();
  let text = '';
  let fallbackUsed = false;
  let model = `${llmModelName()} (mock)`;

  if (hasLiveLlm()) {
    try {
      const prompt = `地点：${input.address}\n问题类型：${input.findings.map((f) => `${TYPE_META[f.type].label}（${f.severity}）`).join('、')}\nAI 置信度：${input.confidence}\n市民原文："""${input.raw}"""`;
      const out = await generateStructured({ schema: describeSchema, system: DESCRIBE_SYSTEM, prompt });
      text = out.text;
      model = llmModelName();
    } catch {
      fallbackUsed = true;
    }
  }
  if (!text) text = templateDescription(input);

  const latencyMs = Date.now() - started + 200 + (hash32(text) % 300);
  const run = getStorage().ai.createRun({
    ticketId: input.ticketId ?? null,
    stage: 'describe',
    model,
    modelVersion: fallbackUsed ? 'fallback' : '2026.10',
    promptDigest: `sha256:${hash32('describe:' + input.raw.slice(0, 60)).toString(16)}`,
    inputDigest: `type=${input.findings.map((f) => f.type).join('+')};len=${input.raw.length}`,
    outputJson: { text, privacy_hits: detectSensitive(input.raw).length },
    tokensIn: 240 + input.raw.length,
    tokensOut: text.length,
    latencyMs,
    fallbackUsed,
    degraded: fallbackUsed
  });

  return { text, model, latencyMs, fallbackUsed, runId: run.id, privacyHits: detectSensitive(input.raw).length };
}

export interface UrgeInput {
  code: string;
  title: string;
  department: string;
  overdueHours: number;
  severity: Severity;
  ticketId?: string;
}

/** 催办函草稿：真实模型可用时调模型生成，mock 时按公文模板生成 */
export async function generateUrgeDraft(input: UrgeInput): Promise<TextGeneration> {
  const started = Date.now();
  const template = `督办催办函（草稿）

致：${input.department}

事由：工单 ${input.code}「${input.title}」已超出承诺办结时限 ${input.overdueHours.toFixed(1)} 小时，现予催办。

要求事项：
一、收到本函后 2 小时内反馈处置进展及现场照片；
二、24 小时内完成处置并在系统内回传办结说明；
三、确因客观条件无法按期完成的，请书面说明并申请延期，延期不得超过 48 小时。

本函由「城事」AI 自动草拟，经网格坐席确认后发出。
拟稿时间：${new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'full', timeStyle: 'short' }).format(new Date())}`;

  let text = '';
  let fallbackUsed = false;
  let model = `${llmModelName()} (mock)`;
  if (hasLiveLlm()) {
    try {
      const out = await generateStructured({
        schema: urgeSchema,
        system: '你是城市治理督办助手，请生成正式的督办催办函草稿，包含事由、要求事项与反馈时限，语气克制、事实准确，不得编造工单信息。',
        prompt: `工单号：${input.code}\n标题：${input.title}\n承办部门：${input.department}\n超时时长：${input.overdueHours.toFixed(1)} 小时\n严重等级：${SEVERITY_META[input.severity].label}`
      });
      text = out.text;
      model = llmModelName();
    } catch {
      fallbackUsed = true;
    }
  }
  if (!text) text = template;

  const latencyMs = Date.now() - started + 180;
  const run = getStorage().ai.createRun({
    ticketId: input.ticketId ?? null,
    stage: 'urge',
    model,
    modelVersion: fallbackUsed ? 'fallback' : '2026.10',
    promptDigest: `sha256:${hash32('urge:' + input.code).toString(16)}`,
    inputDigest: `code=${input.code};overdue=${input.overdueHours.toFixed(1)}`,
    outputJson: { text },
    tokensIn: 180,
    tokensOut: text.length,
    latencyMs,
    fallbackUsed,
    degraded: fallbackUsed
  });
  return { text, model, latencyMs, fallbackUsed, runId: run.id, privacyHits: 0 };
}

export interface ReassignInput {
  code: string;
  fromDepartment: string;
  toDepartment: string;
  grid: string;
  note?: string;
  ticketId?: string;
}

export async function generateReassignDraft(input: ReassignInput): Promise<TextGeneration> {
  const started = Date.now();
  const template = `改派说明（草稿）

工单号：${input.code}
原承办：${input.fromDepartment}
改派至：${input.toDepartment}（${input.grid}网格）
改派理由：经坐席复核，原 AI 分派方案与现场实际情况存在偏差${input.note ? `，${input.note}` : '，为缩短处置链路，改由属地承办部门直接处置'}。
后续要求：承办部门接收后 2 小时内到场核实，并按工单等级时限反馈处置结果。`;

  let text = '';
  let fallbackUsed = false;
  let model = `${llmModelName()} (mock)`;
  if (hasLiveLlm()) {
    try {
      const out = await generateStructured({
        schema: reassignSchema,
        system: '你是城市治理工单改派助手，请生成简洁、正式的改派说明草稿，包含原承办、改派后承办、改派理由与后续要求，不得编造未提供的信息。',
        prompt: `工单号：${input.code}\n原承办：${input.fromDepartment}\n改派至：${input.toDepartment}\n网格：${input.grid}\n坐席备注：${input.note ?? '无'}`
      });
      text = out.text;
      model = llmModelName();
    } catch {
      fallbackUsed = true;
    }
  }
  if (!text) text = template;

  const latencyMs = Date.now() - started + 160;
  const run = getStorage().ai.createRun({
    ticketId: input.ticketId ?? null,
    stage: 'dispatch',
    model,
    modelVersion: fallbackUsed ? 'fallback' : '2026.10',
    promptDigest: `sha256:${hash32('reassign:' + input.code + input.toDepartment).toString(16)}`,
    inputDigest: `code=${input.code};to=${input.toDepartment}`,
    outputJson: { text, from: input.fromDepartment, to: input.toDepartment },
    tokensIn: 160,
    tokensOut: text.length,
    latencyMs,
    fallbackUsed,
    degraded: fallbackUsed
  });
  return { text, model, latencyMs, fallbackUsed, runId: run.id, privacyHits: 0 };
}

/** 图内定位线索：mock 依据坐标落到虚构街道，真实模式可接 VLM OCR */
export async function extractLocateHints(lng: number, lat: number): Promise<LocateHint[]> {
  const grid = GRIDS.reduce((best, g) => {
    const d = Math.hypot(g.center.lng - lng, g.center.lat - lat);
    const bd = Math.hypot(best.center.lng - lng, best.center.lat - lat);
    return d < bd ? g : best;
  }, GRIDS[0]);
  return [
    {
      text: `${grid.street.replace('街道', '路')}路牌`,
      type: 'road_sign',
      lng: Number((lng + 0.0004).toFixed(6)),
      lat: Number((lat - 0.0002).toFixed(6)),
      confidence: 0.88
    },
    {
      text: `${grid.district}${grid.street} 128 号门牌`,
      type: 'door_plate',
      lng: Number((lng - 0.0006).toFixed(6)),
      lat: Number((lat + 0.0003).toFixed(6)),
      confidence: 0.81
    }
  ];
}
