import { MCP_TOOLS, callTool, type McpToolDescriptor, type ToolCallResult, type ToolContext } from './tools';

// MCP Server：对外暴露 tools/list 与 tools/call 语义（stdio 版本见 scripts/mcp-server.mjs）
export function listTools(): McpToolDescriptor[] {
  return MCP_TOOLS;
}

export function getTool(name: string): McpToolDescriptor | undefined {
  return MCP_TOOLS.find((t) => t.name === name);
}

export async function invoke(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolCallResult> {
  return callTool(name, args, ctx);
}
