import { BIZ, fail, readJson } from '@/lib/api';
import { NextResponse } from 'next/server';
import { getTool } from '@/ai/mcp/server';
import { callTool } from '@/ai/mcp/tools';

interface Body {
  args?: Record<string, unknown>;
}

export async function POST(req: Request, context: { params: Promise<{ name: string }> }) {
  const token = req.headers.get('x-mcp-token') ?? '';
  const expected = process.env.MCP_TOKEN || 'demo-mcp-token';
  if (token !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const { name } = await context.params;
  const tool = getTool(name);
  if (!tool) return fail(BIZ.MCP_UNAVAILABLE, `工具不存在：${name}`, 404);
  const body = await readJson<Body>(req, {});
  const started = Date.now();
  const result = await callTool(name, body.args ?? {}, {
    runId: `inspector-${Date.now()}`,
    stepSeq: 1,
    actor: 'mcp-inspector'
  });
  return NextResponse.json({
    ok: result.ok,
    resultCode: result.resultCode,
    summary: result.summary,
    data: result.data,
    latencyMs: Date.now() - started,
    tool: name
  });
}
