import { NextResponse } from 'next/server';
import { CANONICAL_MODELS } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PROGRAM_ID =
  process.env.NEXT_PUBLIC_2_PROGRAM_ID || 'GUDVbE4Jgmtu8jgxUVtq2wUmjdLxJzPqT3zET2EdTLiU';
const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';
const GATEWAY_PUBLIC_URL = 'https://api.wattz.fi';

// Canonical /api/stats contract. Gateway status/latency is a live healthz
// round-trip; model counts come from the canonical catalog (or the live
// registry when the gateway returns entries). No fabricated counters.
export async function GET() {
  const gatewayBase = (process.env.INFERENCE_GATEWAY_URL || GATEWAY_PUBLIC_URL).replace(/\/$/, '');

  let status: 'ok' | 'down' = 'down';
  let latencyMs: number | null = null;
  try {
    const started = Date.now();
    const res = await fetch(`${gatewayBase}/healthz`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      status = 'ok';
      latencyMs = Date.now() - started;
    }
  } catch {
    // Gateway unreachable; report down.
  }

  let relayLive = CANONICAL_MODELS.filter((m) => m.status === 'relay' || m.status === 'live').length;
  let catalog = CANONICAL_MODELS.length;
  if (status === 'ok') {
    try {
      const res = await fetch(`${gatewayBase}/v1/models`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const json = await res.json();
        const data = Array.isArray(json?.data) ? json.data : [];
        if (data.length > 0) {
          catalog = data.length;
          relayLive = data.filter(
            (m: { status?: string }) => m.status === 'relay' || m.status === 'live',
          ).length;
        }
      }
    } catch {
      // Keep canonical counts.
    }
  }

  return NextResponse.json(
    {
      cluster: CLUSTER,
      programId: PROGRAM_ID,
      anchorVersion: '0.31',
      gateway: { status, latencyMs, url: GATEWAY_PUBLIC_URL },
      models: { relayLive, catalog },
      relay: { provider: 'Groq LPU', active: status === 'ok' },
      externalNodes: 0,
    },
    { headers: { 'cache-control': 's-maxage=60, stale-while-revalidate=120' } },
  );
}
