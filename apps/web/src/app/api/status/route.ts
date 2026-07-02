import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Grid status. Every check runs server-side with a hard 5s timeout and
// Promise.allSettled so one slow probe never blocks the row. The relay probe
// issues a real (tiny) chat completion, so it is memoised for five minutes at
// module scope to avoid burning provider quota on every visit.

const GATEWAY = process.env.NEXT_PUBLIC_API_URL || 'https://api.wattz.fi';
const PROGRAM_ID =
  process.env.NEXT_PUBLIC_2_PROGRAM_ID?.trim() ||
  'GUDVbE4Jgmtu8jgxUVtq2wUmjdLxJzPqT3zET2EdTLiU';
const DEVNET_RPC = process.env.SOLANA_DEVNET_RPC || 'https://api.devnet.solana.com';

type State = 'ok' | 'degraded' | 'down';
interface Row {
  id: string;
  label: string;
  state: State;
  detail: string;
  latencyMs: number | null;
  checkedAt: string;
}

const TIMEOUT_MS = 5000;
const RELAY_TTL_MS = 5 * 60 * 1000;

// Module-scoped memo for the relay probe so repeated visits reuse one result.
const relayCache = globalThis as unknown as {
  __wattzRelayProbe?: { at: number; row: Row };
};

function now(): string {
  return new Date().toISOString();
}

async function checkGateway(): Promise<Row> {
  const started = Date.now();
  try {
    const res = await fetch(`${GATEWAY}/healthz`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    const latencyMs = Date.now() - started;
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    const healthy = res.ok && body?.status === 'ok';
    return {
      id: 'gateway',
      label: 'Gateway',
      state: healthy ? 'ok' : 'degraded',
      detail: healthy ? 'api.wattz.fi /healthz responding' : `unexpected response (${res.status})`,
      latencyMs,
      checkedAt: now(),
    };
  } catch {
    return {
      id: 'gateway',
      label: 'Gateway',
      state: 'down',
      detail: 'api.wattz.fi /healthz unreachable',
      latencyMs: null,
      checkedAt: now(),
    };
  }
}

async function checkOpenAiSurface(): Promise<Row> {
  const started = Date.now();
  try {
    const res = await fetch(`${GATEWAY}/v1/models`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    const latencyMs = Date.now() - started;
    const body = (await res.json().catch(() => null)) as { data?: unknown[] } | null;
    const count = Array.isArray(body?.data) ? body!.data!.length : 0;
    if (!res.ok) {
      return {
        id: 'openai',
        label: 'OpenAI surface',
        state: 'down',
        detail: `/v1/models returned ${res.status}`,
        latencyMs,
        checkedAt: now(),
      };
    }
    return {
      id: 'openai',
      label: 'OpenAI surface',
      state: count > 0 ? 'ok' : 'degraded',
      detail:
        count > 0
          ? `/v1/models serving ${count} ${count === 1 ? 'model' : 'models'}`
          : '/v1/models reachable, catalog empty',
      latencyMs,
      checkedAt: now(),
    };
  } catch {
    return {
      id: 'openai',
      label: 'OpenAI surface',
      state: 'down',
      detail: '/v1/models unreachable',
      latencyMs: null,
      checkedAt: now(),
    };
  }
}

async function checkRelay(): Promise<Row> {
  const cached = relayCache.__wattzRelayProbe;
  if (cached && Date.now() - cached.at < RELAY_TTL_MS) {
    return cached.row;
  }
  const started = Date.now();
  let row: Row;
  try {
    const res = await fetch(`${GATEWAY}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 8,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    const latencyMs = Date.now() - started;
    const body = (await res.json().catch(() => null)) as
      | { choices?: unknown[]; wattz?: { provider?: string } }
      | null;
    const served = res.ok && Array.isArray(body?.choices) && body!.choices!.length > 0;
    row = {
      id: 'relay',
      label: 'Relay provider',
      state: served ? 'ok' : 'degraded',
      detail: served
        ? 'Groq LPU relay completing chat requests'
        : `relay probe returned ${res.status}`,
      latencyMs,
      checkedAt: now(),
    };
  } catch {
    row = {
      id: 'relay',
      label: 'Relay provider',
      state: 'down',
      detail: 'relay probe timed out',
      latencyMs: null,
      checkedAt: now(),
    };
  }
  relayCache.__wattzRelayProbe = { at: Date.now(), row };
  return row;
}

async function checkAnchor(): Promise<Row> {
  const started = Date.now();
  try {
    const res = await fetch(DEVNET_RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [PROGRAM_ID, { encoding: 'base64' }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    const latencyMs = Date.now() - started;
    const json = (await res.json().catch(() => null)) as
      | { result?: { value?: { executable?: boolean } } }
      | null;
    const executable = Boolean(json?.result?.value?.executable);
    return {
      id: 'anchor',
      label: 'Anchor program',
      state: executable ? 'ok' : 'degraded',
      detail: executable
        ? 'devnet program account executable'
        : 'program account not confirmed executable',
      latencyMs,
      checkedAt: now(),
    };
  } catch {
    return {
      id: 'anchor',
      label: 'Anchor program',
      state: 'down',
      detail: 'devnet RPC unreachable',
      latencyMs: null,
      checkedAt: now(),
    };
  }
}

function checkWeb(): Row {
  return {
    id: 'web',
    label: 'Web app',
    state: 'ok',
    detail: 'wattz.fi serving this request',
    latencyMs: null,
    checkedAt: now(),
  };
}

export async function GET() {
  const settled = await Promise.allSettled([
    checkGateway(),
    checkOpenAiSurface(),
    checkRelay(),
    checkAnchor(),
  ]);

  const rows: Row[] = settled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    const labels = ['Gateway', 'OpenAI surface', 'Relay provider', 'Anchor program'];
    const ids = ['gateway', 'openai', 'relay', 'anchor'];
    return {
      id: ids[i],
      label: labels[i],
      state: 'down' as State,
      detail: 'check failed',
      latencyMs: null,
      checkedAt: now(),
    };
  });
  rows.push(checkWeb());

  return NextResponse.json(
    { cluster: 'devnet', rows, generatedAt: now() },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    },
  );
}
