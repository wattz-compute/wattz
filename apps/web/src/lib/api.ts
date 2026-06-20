// Client-side API wrapper. All backend traffic routes through same-origin /api
// route handlers, which server-side proxy to INFERENCE_GATEWAY_URL. This
// removes any need for the browser to talk to Railway directly and keeps
// gateway auth tokens on the server.

export interface ModelDescriptor {
  id: string;
  label: string;
  provider: string;
  license: string;
  contextWindow: number;
  inputPer1kUsd: number;
  outputPer1kUsd: number;
  avgLatencyMs: number;
  region: string;
  status: 'live' | 'bootstrap' | 'queued';
}

export interface NetworkStats {
  gpuNodes: number;
  models: number;
  activeTflops: number;
  inferencesPerDay: number;
  bootstrapNodesOnline: number;
  teeAttestations24h: number;
}

export interface InferencePayload {
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AttestationSummary {
  proofHash: string;
  attestationType: 'sgx' | 'sev' | 'nvidia-cc' | 'risc0' | 'sp1';
  verifier: string;
  timestamp: number;
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

// SSE inference stream. Yields incremental deltas until [DONE].
export async function* streamInference(
  payload: InferencePayload,
  signal?: AbortSignal,
): AsyncGenerator<
  | { kind: 'delta'; content: string }
  | { kind: 'meta'; latencyMs: number; region: string; costUsd: number }
  | { kind: 'attestation'; attestation: AttestationSummary }
  | { kind: 'done' }
> {
  const res = await fetch('/api/inference', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...payload, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Inference request failed: ${res.status}`);
  }

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

      const dataLine = rawEvent
        .split('\n')
        .find((line) => line.startsWith('data:'));
      if (!dataLine) continue;

      const data = dataLine.slice(5).trim();
      if (data === '[DONE]') {
        yield { kind: 'done' };
        return;
      }

      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'meta') {
          yield {
            kind: 'meta',
            latencyMs: parsed.latencyMs,
            region: parsed.region,
            costUsd: parsed.costUsd,
          };
        } else if (parsed.type === 'attestation') {
          yield { kind: 'attestation', attestation: parsed.attestation };
        } else if (parsed.type === 'delta') {
          yield { kind: 'delta', content: parsed.content };
        }
      } catch {
        // Skip malformed frames rather than tear down the stream.
      }
    }
  }
  yield { kind: 'done' };
}
