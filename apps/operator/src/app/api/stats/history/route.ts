import { NextResponse } from 'next/server';
import { proxyJson } from '@/lib/env';
import { baselineStatsHistory } from '@/lib/baseline';
import type { StatsHistoryResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await proxyJson<StatsHistoryResponse>('/stats/history');
  if (result.ok && Array.isArray(result.data?.data) && result.data.data.length > 0) {
    return NextResponse.json(result.data);
  }
  return NextResponse.json(baselineStatsHistory());
}
