import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Baseline model catalog. When INFERENCE_GATEWAY_URL is reachable we replace
// this response with the live registry snapshot. Otherwise we serve a curated
// list so the UI is never blank on cold deploys.
const BASELINE = [
  {
    id: 'llama-3-8b-instruct',
    label: 'Llama 3 8B Instruct',
    provider: 'Meta',
    license: 'Llama Community License',
    contextWindow: 8192,
    inputPer1kUsd: 0.0006,
    outputPer1kUsd: 0.0008,
    avgLatencyMs: 260,
    region: 'US-East',
    status: 'live' as const,
  },
  {
    id: 'mistral-7b-instruct-v0.3',
    label: 'Mistral 7B Instruct v0.3',
    provider: 'Mistral',
    license: 'Apache 2.0',
    contextWindow: 32768,
    inputPer1kUsd: 0.00045,
    outputPer1kUsd: 0.00065,
    avgLatencyMs: 220,
    region: 'EU-West',
    status: 'live' as const,
  },
  {
    id: 'stable-diffusion-xl-1.0',
    label: 'Stable Diffusion XL 1.0',
    provider: 'Stability AI',
    license: 'CreativeML OpenRAIL-M',
    contextWindow: 77,
    inputPer1kUsd: 0.019,
    outputPer1kUsd: 0,
    avgLatencyMs: 4200,
    region: 'JP',
    status: 'bootstrap' as const,
  },
  {
    id: 'whisper-large-v3',
    label: 'Whisper Large v3',
    provider: 'OpenAI',
    license: 'MIT',
    contextWindow: 3000,
    inputPer1kUsd: 0.0002,
    outputPer1kUsd: 0.0006,
    avgLatencyMs: 340,
    region: 'US-West',
    status: 'live' as const,
  },
  {
    id: 'gpt-oss-20b',
    label: 'GPT-OSS 20B',
    provider: 'Community',
    license: 'Apache 2.0',
    contextWindow: 16384,
    inputPer1kUsd: 0.0012,
    outputPer1kUsd: 0.0018,
    avgLatencyMs: 380,
    region: 'SG',
    status: 'queued' as const,
  },
];

export async function GET() {
  const gateway = process.env.INFERENCE_GATEWAY_URL;
  if (gateway) {
    try {
      const res = await fetch(`${gateway.replace(/\/$/, '')}/v1/models`, {
        cache: 'no-store',
        headers: process.env.GATEWAY_AUTH_TOKEN
          ? { authorization: `Bearer ${process.env.GATEWAY_AUTH_TOKEN}` }
          : undefined,
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return NextResponse.json(data);
        }
      }
    } catch {
      // Gateway may be offline during cold start; fall through to baseline.
    }
  }
  return NextResponse.json(BASELINE);
}
