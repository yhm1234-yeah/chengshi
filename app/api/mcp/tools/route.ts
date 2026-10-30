import { ok } from '@/lib/api';
import { listTools } from '@/ai/mcp/server';

export async function GET() {
  return ok({
    transport: process.env.MCP_TRANSPORT || 'stdio',
    version: '1.0',
    tools: listTools()
  });
}
