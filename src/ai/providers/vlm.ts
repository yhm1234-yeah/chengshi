import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import type { z } from 'zod';
import type { ClassifyOutput } from '@/ai/schemas';

// 视觉模型：通义千问 VL Max 主 / GPT-4o 备；未配置密钥时由 classify 链走 mock

const CLASSIFY_SYSTEM = `你是城市管理问题识别助手。请基于照片判断问题类型并输出结构化 JSON。

【七类判定标准】
T01 井盖破损/缺失：圆形或方形井盖出现裂纹、缺失、下沉、井圈翘起，可能伴随暴露的井口。
T02 违停占道：机动车停在禁停区、消防通道、人行道或非机动车道，阻碍通行。
T03 垃圾堆积：生活垃圾、装修垃圾成堆，超过垃圾桶容量且未清运。
T04 路灯故障：灯具不亮、闪烁、灯杆倾斜、线缆外露。
T05 积水内涝：路面积水成片，深度可辨，排水口堵塞或雨水倒灌。
T06 广告牌隐患：广告牌松动、锈蚀、倾斜、遮挡视线。
T07 其他：无法归入以上六类，需人工研判。

【易混淆反例】
- 井盖周围的路面裂缝 ≠ T01，只有井盖本体或井圈损坏才判 T01；
- 临时停靠上下客 ≠ T02，须能看出持续占用且阻碍通行；
- 单个垃圾桶满溢 ≠ T03，成堆且长时间未清运才判 T03。

【输出要求】
1. type 取 T01–T07；severity 取 low / medium / urgent；confidence 取 0–1，保留两位小数；
2. evidence 为归一化坐标（相对图片宽高的 0–1 比例），每项含 x、y、w、h、label；
3. 若画面含多个问题，findings 逐条列出，每条含 type、severity、confidence、evidence、desc；
4. quality_flags 在模糊、逆光、主体缺失、遮挡时给出标记；
5. reason 用一句中文说明判定依据，不得编造画面中不存在的物体。`;

function vlmClient(which: 'primary' | 'fallback') {
  const key = which === 'primary' ? process.env.VLM_API_KEY : process.env.VLM_FALLBACK_API_KEY;
  const baseURL =
    which === 'primary'
      ? process.env.VLM_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      : process.env.VLM_FALLBACK_BASE_URL || 'https://api.openai.com/v1';
  return createOpenAI({ apiKey: key || 'mock-key', baseURL, compatibility: 'compatible' });
}

export function hasLiveVlm(): boolean {
  return Boolean(process.env.VLM_API_KEY);
}

export function vlmModelName(): string {
  return process.env.VLM_MODEL || 'qwen-vl-max';
}

interface VlmAttempt {
  output: ClassifyOutput;
  model: string;
  fallbackUsed: boolean;
  latencyMs: number;
}

export async function classifyWithVlm(
  imageUrls: string[],
  schema: z.ZodType<ClassifyOutput>,
  hint?: string
): Promise<VlmAttempt> {
  const started = Date.now();
  const attempts: { which: 'primary' | 'fallback'; model: string }[] = [
    { which: 'primary', model: vlmModelName() },
    { which: 'fallback', model: process.env.VLM_FALLBACK_MODEL || 'gpt-4o' }
  ];

  let lastError: unknown = null;
  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i];
    if (attempt.which === 'fallback' && !process.env.VLM_FALLBACK_API_KEY) break;
    try {
      const client = vlmClient(attempt.which);
      const text = `请识别这张城市问题照片。${hint ? `市民补充：${hint}` : ''} 只输出符合 Schema 的 JSON。`;
      const result = await generateObject({
        model: client(attempt.model),
        schema,
        system: CLASSIFY_SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text },
              ...imageUrls.slice(0, 3).map((url) => ({ type: 'image' as const, image: url }))
            ]
          }
        ],
        abortSignal: AbortSignal.timeout(8000)
      });
      return {
        output: result.object as ClassifyOutput,
        model: attempt.model,
        fallbackUsed: i > 0,
        latencyMs: Date.now() - started
      };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('VLM 调用失败');
}

export const VLM_SYSTEM_PROMPT = CLASSIFY_SYSTEM;
