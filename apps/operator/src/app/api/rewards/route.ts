import { NextResponse } from 'next/server';
import { proxyJson } from '@/lib/env';
import { baselineRewards } from '@/lib/baseline';
import type { RewardsSnapshot } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const operator = url.searchParams.get('operator');
  if (!operator) {
    return NextResponse.json(
      { error: { message: 'operator query param is required' } },
      { status: 400 },
    );
  }
  const result = await proxyJson<RewardsSnapshot>(
    `/rewards?operator=${encodeURIComponent(operator)}`,
  );
  if (result.ok) {
    return NextResponse.json(result.data);
  }
  return NextResponse.json(baselineRewards(operator));
}
