export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Envelope<T> {
  code: number;
  message: string;
  data: T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
  return unwrap<T>(res);
}

export async function apiPost<T>(path: string, body: unknown = {}): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin'
  });
  return unwrap<T>(res);
}

async function unwrap<T>(res: Response): Promise<T> {
  let json: Envelope<T> | { message?: string; code?: number } | null = null;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError(`请求失败（HTTP ${res.status}）`, res.status, res.status);
  }
  const payload = json as Envelope<T>;
  if (!res.ok || payload.code !== 0) {
    throw new ApiError(payload.message || `请求失败（HTTP ${res.status}）`, payload.code ?? res.status, res.status);
  }
  return payload.data;
}

export interface StreamMessage {
  event: string;
  data: Record<string, unknown>;
}

/** 带鉴权的 SSE 流式请求；返回中止函数 */
export async function streamPost(
  path: string,
  body: unknown,
  onEvent: (msg: StreamMessage) => void,
  onDone?: () => void
): Promise<() => void> {
  const controller = new AbortController();
  const run = async () => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
      signal: controller.signal
    });
    if (!res.ok || !res.body) {
      let message = `请求失败（HTTP ${res.status}）`;
      try {
        const json = (await res.json()) as { message?: string };
        if (json.message) message = json.message;
      } catch {
        // ignore
      }
      throw new ApiError(message, res.status, res.status);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';
      for (const block of blocks) {
        let event = 'message';
        const dataLines: string[] = [];
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;
        try {
          onEvent({ event, data: JSON.parse(dataLines.join('\n')) as Record<string, unknown> });
        } catch {
          // 忽略非 JSON 数据
        }
      }
    }
    onDone?.();
  };
  run().catch((err: unknown) => {
    if (err instanceof Error && err.name === 'AbortError') return;
    onEvent({ event: 'error', data: { message: err instanceof Error ? err.message : '网络异常' } });
    onDone?.();
  });
  return () => controller.abort();
}
