import { NextResponse } from 'next/server';

export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
  requestId: string;
}

export function requestId(prefix = 'req'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiEnvelope<T>> {
  return NextResponse.json(
    { code: 0, message: 'ok', data, requestId: requestId() },
    { status: 200, ...init }
  );
}

export function fail(bizCode: number, message: string, status = 400): NextResponse<ApiEnvelope<null>> {
  return NextResponse.json(
    { code: bizCode, message, data: null, requestId: requestId('err') },
    { status }
  );
}

export async function readJson<T>(req: Request, fallback: T): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return fallback;
  }
}

export const BIZ = {
  UNAUTHORIZED: 10001,
  FORBIDDEN: 10002,
  RATE_LIMITED: 10003,
  VALIDATION: 20001,
  IDEMPOTENT: 20002,
  LOW_CONFIDENCE: 30001,
  DEGRADED: 30002,
  NO_SOURCE: 30003,
  SCHEMA_INVALID: 30004,
  NOT_FOUND: 40001,
  FSM_INVALID: 40002,
  MCP_UNAVAILABLE: 50001
} as const;
