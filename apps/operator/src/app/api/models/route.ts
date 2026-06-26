import { NextResponse } from 'next/server';
import { proxyJson } from '@/lib/env';
import type { ModelListResponse } from '@/types/wattz';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await proxyJson<ModelListResponse>('/models');
  if (!result.ok) {
    return NextResponse.json({ error: { message: result.message } }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
