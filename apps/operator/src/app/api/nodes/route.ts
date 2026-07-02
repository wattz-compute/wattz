import { NextResponse } from 'next/server';
import { proxyJson } from '@/lib/env';
import { baselineNodeList } from '@/lib/baseline';
import type { NodeListResponse } from '@/types/wattz';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const operator = url.searchParams.get('operator') ?? undefined;
  const path = operator ? `/nodes?operator=${encodeURIComponent(operator)}` : '/nodes';
  const result = await proxyJson<NodeListResponse>(path);
  if (result.ok) {
    // For the network view, an empty upstream list means no node has registered
    // yet; show the labelled network preview instead of an empty grid. An
    // operator-scoped empty list is a real, honest empty state and passes
    // through untouched.
    if (!operator && result.data.data.length === 0) {
      return NextResponse.json(baselineNodeList(operator));
    }
    return NextResponse.json(result.data);
  }
  // Gateway unreachable or non-2xx. Fall back to baseline so the dashboard
  // renders a labelled preview instead of a red error panel.
  return NextResponse.json(baselineNodeList(operator));
}
