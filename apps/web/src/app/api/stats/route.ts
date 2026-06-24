import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Baseline network snapshot. Replaced by the gateway when available.
const BASELINE = {
  gpuNodes: 6,
  models: 5,
  activeTflops: 268,
  inferencesPerDay: 42130,
  bootstrapNodesOnline: 2,
  teeAttestations24h: 12184,
};

export async function GET() {
  const gateway = process.env.INFERENCE_GATEWAY_URL;
  if (gateway) {
    try {
      const res = await fetch(`${gateway.replace(/\/$/, '')}/v1/network/stats`, {
        cache: 'no-store',
        headers: process.env.GATEWAY_AUTH_TOKEN
          ? { authorization: `Bearer ${process.env.GATEWAY_AUTH_TOKEN}` }
          : undefined,
      });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          return NextResponse.json({ ...BASELINE, ...data });
        }
      }
    } catch {
      // Fall through to baseline.
    }
  }
  return NextResponse.json(BASELINE);
}
