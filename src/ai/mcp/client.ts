import { invoke as serverInvoke, listTools as serverList } from './server';
import type { McpToolDescriptor, ToolCallResult } from './tools';

// Agent 只能通过 MCP 客户端访问外部工具，不允许直接 import tools.ts 的实现
export class McpClient {
  async listTools(): Promise<McpToolDescriptor[]> {
    return serverList();
  }

  async call(
    name: string,
    args: Record<string, unknown>,
    ctx: { runId: string; stepSeq: number; actor: string }
  ): Promise<ToolCallResult & { latencyMs: number }> {
    const started = Date.now();
    const result = await serverInvoke(name, args, ctx);
    return { ...result, latencyMs: Date.now() - started };
  }
}

export const mcpClient = new McpClient();
