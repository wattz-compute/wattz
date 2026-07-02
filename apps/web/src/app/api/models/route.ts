import { NextResponse } from 'next/server';
import { CANONICAL_MODELS, mapGatewayModel, type ModelDescriptor } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// The canonical catalog (three relay-live chat models + two awaiting a
// bare-metal node) is the source of truth. When the gateway's /v1/models
// returns a populated list we map that live registry instead; an empty list
// or an unreachable gateway falls back to the canonical catalog so the UI is
// never blank.
export async function GET() {
  const gateway = process.env.INFERENCE_GATEWAY_URL;
  if (gateway) {
    try {
      const res = await fetch(`${gateway.replace(/\/$/, '')}/v1/models`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
        headers: process.env.GATEWAY_AUTH_TOKEN
          ? { authorization: `Bearer ${process.env.GATEWAY_AUTH_TOKEN}` }
          : undefined,
      });
      if (res.ok) {
        const json = await res.json();
        const data = Array.isArray(json?.data) ? (json.data as Record<string, unknown>[]) : [];
        if (data.length > 0) {
          const mapped: ModelDescriptor[] = data.map(mapGatewayModel);
          return NextResponse.json(mapped, {
            headers: { 'cache-control': 's-maxage=60, stale-while-revalidate=120' },
          });
        }
      }
    } catch {
      // Gateway offline or slow; fall through to the canonical catalog.
    }
  }
  return NextResponse.json(CANONICAL_MODELS, {
    headers: { 'cache-control': 's-maxage=60, stale-while-revalidate=120' },
  });
}
