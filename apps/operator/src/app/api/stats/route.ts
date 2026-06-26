import { NextResponse } from 'next/server';
import { proxyJson } from '@/lib/env';
import type { OperatorStats } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const operator = url.searchParams.get('operator');
  const path = operator ? `/stats/operator/${encodeURIComponent(operator)}` : '/stats';
  const result = await proxyJson<OperatorStats>(path);
  if (!result.ok) {
    return NextResponse.json({ error: { message: result.message } }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
