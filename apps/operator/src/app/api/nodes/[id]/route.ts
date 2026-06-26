import { NextResponse } from 'next/server';
import { proxyJson } from '@/lib/env';
import type { NodeDetail } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const result = await proxyJson<NodeDetail>(`/nodes/${encodeURIComponent(params.id)}`);
  if (!result.ok) {
    return NextResponse.json({ error: { message: result.message } }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
