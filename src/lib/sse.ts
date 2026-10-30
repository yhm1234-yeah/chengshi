// SSE 协议封装：服务端生成器 + 客户端解析器（三类流式接口共用）
export interface SseMessage {
  event: string;
  data: Record<string, unknown>;
}

/** Route Handler 中把事件流序列化为 text/event-stream */
export function sseResponse(events: AsyncIterable<SseMessage>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const msg of events) {
          controller.enqueue(encoder.encode(`event: ${msg.event}\ndata: ${JSON.stringify(msg.data)}\n\n`));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown';
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`));
      } finally {
        controller.close();
      }
    }
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}

/** 客户端解析 fetch POST 返回的 SSE 流 */
export async function readSseStream(
  res: Response,
  onEvent: (msg: SseMessage) => void
): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      const lines = block.split('\n');
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      if (!dataLines.length) continue;
      try {
        onEvent({ event, data: JSON.parse(dataLines.join('\n')) as Record<string, unknown> });
      } catch {
        onEvent({ event, data: { raw: dataLines.join('\n') } });
      }
    }
  }
}
