import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface Payload {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

const MAX_CONTENT_CHARS = 8000;
const MAX_TOKENS_CAP = 1024;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const CONNECT_TIMEOUT_MS = 8000;

// Per-IP sliding window. In-memory, resets on cold start -- an abuse speed
// bump in front of the upstream relay, not a durable quota.
const hits = new Map<string, number[]>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

// Returns retry-after ms when the caller is over the limit, else null.
function rateLimited(ip: string): number | null {
  const now = Date.now();
  if (hits.size > 5000) hits.clear();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return Math.max(1000, RATE_WINDOW_MS - (now - recent[0]));
  }
  recent.push(now);
  hits.set(ip, recent);
  return null;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return null;
}

function sseStream(frames: unknown[], source: string): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-wattz-source': source,
    },
  });
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const retryMs = rateLimited(ip);
  if (retryMs !== null) {
    return new Response(JSON.stringify({ error: 'rate limit exceeded' }), {
      status: 429,
      headers: {
        'content-type': 'application/json',
        'retry-after': String(Math.ceil(retryMs / 1000)),
      },
    });
  }

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (!payload.model || !Array.isArray(payload.messages) || payload.messages.length === 0) {
    return new Response('model and messages required', { status: 400 });
  }

  const totalChars = payload.messages.reduce(
    (n, m) => n + (typeof m.content === 'string' ? m.content.length : 0),
    0,
  );
  if (totalChars > MAX_CONTENT_CHARS) {
    return new Response(
      JSON.stringify({ error: `message content exceeds ${MAX_CONTENT_CHARS} characters` }),
      { status: 413, headers: { 'content-type': 'application/json' } },
    );
  }

  const temperature = clamp(payload.temperature ?? 0.7, 0, 2);
  const maxTokens = Math.round(clamp(payload.maxTokens ?? 512, 1, MAX_TOKENS_CAP));

  const gateway = process.env.INFERENCE_GATEWAY_URL;
  const token = process.env.GATEWAY_AUTH_TOKEN;

  // Fallback path: no gateway configured. Emit a single status frame so the UI
  // can render an honest "relay warming" state -- no synthetic content, no
  // fabricated attestation.
  if (!gateway) {
    return sseStream([{ type: 'status', mode: 'bootstrap-relay', attested: false }], 'bootstrap-relay');
  }

  // Connect timeout that is cleared once headers arrive, so the body stream
  // stays open for the full generation. Client disconnects still abort via
  // req.signal.
  const connect = new AbortController();
  const timer = setTimeout(() => connect.abort(), CONNECT_TIMEOUT_MS);
  const signal = AbortSignal.any([req.signal, connect.signal]);

  let upstream: Response;
  try {
    upstream = await fetch(`${gateway.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        model: payload.model,
        messages: payload.messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
      signal,
    });
  } catch {
    clearTimeout(timer);
    return sseStream(
      [{ type: 'error', status: 502, message: 'gateway unreachable — relay warming', retryAfterMs: null }],
      'gateway-error',
    );
  }
  clearTimeout(timer);

  if (!upstream.ok || !upstream.body) {
    const retryAfterMs = parseRetryAfter(upstream.headers.get('retry-after'));
    let message = `gateway responded ${upstream.status}`;
    try {
      const text = await upstream.text();
      if (text) message = text.slice(0, 300);
    } catch {
      // Keep the generic message.
    }
    return sseStream(
      [{ type: 'error', status: upstream.status, message, retryAfterMs }],
      'gateway-error',
    );
  }

  const headers = new Headers({
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-wattz-source': 'gateway-proxy',
  });
  // Forward Wattz route metadata (node / region / request id) to the client.
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase().startsWith('x-wattz-')) headers.set(key, value);
  });

  return new Response(upstream.body, { status: 200, headers });
}
