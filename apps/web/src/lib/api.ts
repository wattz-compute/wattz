// Client-side API wrapper. All backend traffic routes through same-origin /api
// route handlers, which server-side proxy to INFERENCE_GATEWAY_URL. This
// removes any need for the browser to talk to the gateway directly and keeps
// gateway auth tokens on the server.
//
// The canonical model catalog and the gateway->descriptor mapper also live
// here so the /api/models and /api/stats route handlers share one source of
// truth. Only the pure data (CANONICAL_MODELS, mapGatewayModel) is imported
// server-side; the fetch helpers below are browser-only.

export type ModelStatus = 'live' | 'relay' | 'awaiting node';
export type ModelModality = 'chat' | 'audio' | 'image';

export interface ModelDescriptor {
  id: string;
  label: string;
  provider: string;
  license: string;
  contextWindow: number;
  modality: ModelModality;
  status: ModelStatus;
  // Human-readable serving note, e.g. 'relayed via Groq LPU'. Null when the
  // model is not currently served (awaiting a bare-metal node).
  servedVia: string | null;
  // Region label only when a real region is known. Relay traffic omits it
  // rather than inventing a datacenter.
  region: string | null;
  selectable: boolean;
}

export interface GatewayStatus {
  status: 'ok' | 'down';
  latencyMs: number | null;
  url: string;
}

// Canonical /api/stats contract. No fabricated counters.
export interface NetworkStats {
  cluster: string;
  programId: string;
  anchorVersion: string;
  gateway: GatewayStatus;
  models: { relayLive: number; catalog: number };
  relay: { provider: string; active: boolean };
  externalNodes: number;
}

export interface InferencePayload {
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

// A verified attestation only ever originates from a real bare-metal node
// (non-streaming settlement path). The Groq relay leg is never attested.
export interface AttestationSummary {
  kind: 'verified';
  attestationType: 'sgx' | 'sev' | 'nvidia-cc' | 'risc0' | 'sp1';
  verifier: string;
  proofHash: string;
  timestamp: number;
}

// Route provenance surfaced from the response headers / meta frame. Used for
// honest share-card stamps and the relay disclosure panel.
export interface RouteMeta {
  node: string | null;
  region: string | null;
  requestId: string | null;
  source: string | null;
}

// Canonical five-entry catalog. Three chat models are live through the Groq
// LPU relay; two are listed but await a bare-metal node before they can serve.
export const CANONICAL_MODELS: ModelDescriptor[] = [
  {
    id: 'llama-3.1-8b-instant',
    label: 'Llama 3.1 8B Instant',
    provider: 'Meta',
    license: 'Llama 3.1 Community License',
    contextWindow: 131072,
    modality: 'chat',
    status: 'relay',
    servedVia: 'relayed via Groq LPU',
    region: null,
    selectable: true,
  },
  {
    id: 'llama-3.3-70b-versatile',
    label: 'Llama 3.3 70B Versatile',
    provider: 'Meta',
    license: 'Llama 3.3 Community License',
    contextWindow: 131072,
    modality: 'chat',
    status: 'relay',
    servedVia: 'relayed via Groq LPU',
    region: null,
    selectable: true,
  },
  {
    id: 'gpt-oss-20b',
    label: 'GPT-OSS 20B',
    provider: 'OpenAI',
    license: 'Apache 2.0',
    contextWindow: 131072,
    modality: 'chat',
    status: 'relay',
    servedVia: 'relayed via Groq LPU',
    region: null,
    selectable: true,
  },
  {
    id: 'whisper-large-v3',
    label: 'Whisper Large v3',
    provider: 'OpenAI',
    license: 'Apache 2.0',
    contextWindow: 0,
    modality: 'audio',
    status: 'awaiting node',
    servedVia: null,
    region: null,
    selectable: false,
  },
  {
    id: 'stable-diffusion-xl-1.0',
    label: 'Stable Diffusion XL 1.0',
    provider: 'Stability AI',
    license: 'CreativeML OpenRAIL-M',
    contextWindow: 0,
    modality: 'image',
    status: 'awaiting node',
    servedVia: null,
    region: null,
    selectable: false,
  },
];

// Map one gateway /v1/models entry (OpenAI list shape, optionally extended
// with model_id / max_context / license / serving_nodes) onto a
// ModelDescriptor, filling gaps from the canonical catalog when possible.
export function mapGatewayModel(entry: Record<string, unknown>): ModelDescriptor {
  const id = String(entry.model_id ?? entry.id ?? '');
  const canonical = CANONICAL_MODELS.find((m) => m.id === id);
  const servingNodes = Number(entry.serving_nodes ?? 0);
  const modality = canonical?.modality ?? 'chat';
  const served = servingNodes > 0;
  return {
    id,
    label: String(entry.label ?? canonical?.label ?? id),
    provider: String(entry.provider ?? entry.owned_by ?? canonical?.provider ?? 'unknown'),
    license: String(entry.license ?? canonical?.license ?? 'unknown'),
    contextWindow: Number(
      entry.max_context ?? entry.context_window ?? canonical?.contextWindow ?? 0,
    ),
    modality,
    status: served ? 'live' : modality === 'chat' ? 'relay' : 'awaiting node',
    servedVia: served ? null : modality === 'chat' ? 'relayed via Groq LPU' : null,
    region: null,
    selectable: modality === 'chat',
  };
}

export async function fetchModels(): Promise<ModelDescriptor[]> {
  const res = await fetch('/api/models', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load models: ${res.status}`);
  return res.json();
}

export async function fetchStats(): Promise<NetworkStats> {
  const res = await fetch('/api/stats', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load stats: ${res.status}`);
  return res.json();
}

export async function fetchHealth(): Promise<{ ok: boolean; ts: number }> {
  const res = await fetch('/api/health', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export type StreamEvent =
  | { kind: 'meta'; meta: RouteMeta }
  | { kind: 'delta'; content: string }
  | { kind: 'usage'; tokensIn: number | null; tokensOut: number | null }
  | { kind: 'attestation'; attestation: AttestationSummary }
  | { kind: 'status'; mode: string; attested: boolean }
  | { kind: 'error'; status: number; message: string; retryAfterMs: number | null }
  | { kind: 'done' };

// SSE inference stream. The gateway relays raw OpenAI chunks byte-for-byte
// (choices[].delta.content, plus usage / x_groq.usage on the final chunk), so
// the parser handles both the raw OpenAI shape and the Wattz status/error
// envelope emitted by the fallback path. Route metadata (node, region,
// request id) is read from the same-origin response headers.
export async function* streamInference(
  payload: InferencePayload,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const res = await fetch('/api/inference', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...payload, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Inference request failed: ${res.status}`);
  }

  yield {
    kind: 'meta',
    meta: {
      node: res.headers.get('x-wattz-node'),
      region: res.headers.get('x-wattz-region'),
      requestId: res.headers.get('x-wattz-request-id'),
      source: res.headers.get('x-wattz-source'),
    },
  };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      if (!rawEvent) continue;

      // A single SSE event may carry multiple `data:` lines.
      const dataLines = rawEvent
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim());
      if (dataLines.length === 0) continue;
      const data = dataLines.join('');

      if (data === '[DONE]') {
        yield { kind: 'done' };
        return;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue; // Skip malformed frames rather than tear down the stream.
      }

      yield* interpretFrame(parsed);
    }
  }
  yield { kind: 'done' };
}

function* interpretFrame(parsed: Record<string, unknown>): Generator<StreamEvent> {
  const type = parsed.type;

  // Wattz control envelope (fallback / error paths).
  if (type === 'status') {
    yield { kind: 'status', mode: String(parsed.mode ?? 'relay'), attested: Boolean(parsed.attested) };
    return;
  }
  if (type === 'error') {
    yield {
      kind: 'error',
      status: Number(parsed.status ?? 502),
      message: String(parsed.message ?? 'inference error'),
      retryAfterMs:
        parsed.retryAfterMs == null ? null : Number(parsed.retryAfterMs),
    };
    return;
  }
  if (type === 'delta' && typeof parsed.content === 'string') {
    yield { kind: 'delta', content: parsed.content };
    return;
  }
  if (type === 'attestation' && parsed.attestation) {
    const a = parsed.attestation as Record<string, unknown>;
    // Only surface a verified attestation; relay legs never reach here.
    if (a.verified === true && typeof a.kind === 'string' && a.kind !== 'relay') {
      yield {
        kind: 'attestation',
        attestation: {
          kind: 'verified',
          attestationType: (a.attestationType as AttestationSummary['attestationType']) ?? 'sgx',
          verifier: String(a.verifier ?? ''),
          proofHash: String(a.proofHash ?? ''),
          timestamp: Number(a.timestamp ?? Date.now()),
        },
      };
    }
    return;
  }

  // Raw OpenAI chunk relayed byte-for-byte from the gateway.
  const choices = parsed.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const delta = (choices[0] as Record<string, unknown>)?.delta as
      | Record<string, unknown>
      | undefined;
    const content = delta?.content;
    if (typeof content === 'string' && content.length > 0) {
      yield { kind: 'delta', content };
    }
  }

  // Usage may ride on the final OpenAI chunk (usage or x_groq.usage).
  const usage = extractUsage(parsed);
  if (usage) yield usage;

  // Bare gateway error object (Groq relay error frame).
  const errObj = parsed.error as Record<string, unknown> | undefined;
  if (errObj && typeof errObj.message === 'string') {
    yield {
      kind: 'error',
      status: Number(errObj.status ?? 502),
      message: errObj.message,
      retryAfterMs: null,
    };
  }
}

function extractUsage(
  parsed: Record<string, unknown>,
): { kind: 'usage'; tokensIn: number | null; tokensOut: number | null } | null {
  const xGroq = parsed.x_groq as Record<string, unknown> | undefined;
  const usage = (parsed.usage ?? xGroq?.usage) as Record<string, unknown> | undefined;
  if (!usage) return null;
  const tokensIn = usage.prompt_tokens != null ? Number(usage.prompt_tokens) : null;
  const tokensOut = usage.completion_tokens != null ? Number(usage.completion_tokens) : null;
  if (tokensIn == null && tokensOut == null) return null;
  return { kind: 'usage', tokensIn, tokensOut };
}
