import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, streamText } from 'ai';
import type { z } from 'zod';

// 文本模型：DeepSeek V3 主 / 智谱 GLM-4 备（可在环境变量切换 OpenAI 兼容端点）
function llmClient() {
  return createOpenAI({
    apiKey: process.env.LLM_API_KEY || 'mock-key',
    baseURL: process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1',
    compatibility: 'compatible'
  });
}

export function hasLiveLlm(): boolean {
  return Boolean(process.env.LLM_API_KEY);
}

export function llmModelName(): string {
  return process.env.LLM_MODEL || 'deepseek-chat';
}

/** 结构化生成（A1）：mock 与真实模型走同一函数，仅 provider 不同 */
export async function generateStructured<T>(options: {
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  temperature?: number;
}): Promise<T> {
  const client = llmClient();
  const result = await generateObject({
    model: client(llmModelName()),
    schema: options.schema,
    system: options.system,
    prompt: options.prompt,
    temperature: options.temperature ?? 0.3,
    abortSignal: AbortSignal.timeout(20000)
  });
  return result.object as T;
}

/** 流式文本（规范描述 / 对话 / 催办函） */
export async function* streamLlm(system: string, prompt: string): AsyncGenerator<string> {
  if (!hasLiveLlm()) return;
  try {
    const result = streamText({
      model: llmClient()(llmModelName()),
      system,
      prompt,
      temperature: 0.4,
      abortSignal: AbortSignal.timeout(60000)
    });
    for await (const delta of result.textStream) {
      if (delta) yield delta;
    }
  } catch {
    // 流式失败时静默，由上层统一降级为模板输出
  }
}
