import { NextResponse } from 'next/server';
import { proxyJson } from '@/lib/env';
import { baselineNodeDetail } from '@/lib/baseline';
import type { NodeDetail } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const result = await proxyJson<NodeDetail>(`/nodes/${encodeURIComponent(params.id)}`);
  if (result.ok) {
    return NextResponse.json(result.data);
  }
  // Gateway unreachable: synthesize a consistent preview for a known node so the
  // drill-down opens instead of 404ing on every card.
  const preview = baselineNodeDetail(params.id);
  if (preview) {
    return NextResponse.json(preview);
  }
  return NextResponse.json({ error: { message: result.message } }, { status: result.status });
}
