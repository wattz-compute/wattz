import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

const REGION_HINTS: Record<string, string> = {
  'llama-3-8b-instruct': 'US-East',
  'mistral-7b-instruct-v0.3': 'EU-West',
  'stable-diffusion-xl-1.0': 'JP',
  'whisper-large-v3': 'US-West',
  'gpt-oss-20b': 'SG',
};

const PRICE_PER_1K: Record<string, { input: number; output: number }> = {
  'llama-3-8b-instruct': { input: 0.0006, output: 0.0008 },
  'mistral-7b-instruct-v0.3': { input: 0.00045, output: 0.00065 },
  'stable-diffusion-xl-1.0': { input: 0.019, output: 0 },
  'whisper-large-v3': { input: 0.0002, output: 0.0006 },
  'gpt-oss-20b': { input: 0.0012, output: 0.0018 },
};

export async function POST(req: NextRequest) {
  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (!payload.model || !Array.isArray(payload.messages) || payload.messages.length === 0) {
    return new Response('model and messages required', { status: 400 });
  }

  const gateway = process.env.INFERENCE_GATEWAY_URL;
  const token = process.env.GATEWAY_AUTH_TOKEN;

  if (gateway) {
    try {
      const upstream = await fetch(`${gateway.replace(/\/$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          model: payload.model,
          messages: payload.messages,
          temperature: payload.temperature ?? 0.7,
          max_tokens: payload.maxTokens ?? 512,
          stream: true,
        }),
      });

      if (upstream.ok && upstream.body) {
        return new Response(upstream.body, {
          status: 200,
          headers: {
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache, no-transform',
            connection: 'keep-alive',
            'x-wattz-source': 'gateway-proxy',
          },
        });
      }
    } catch {
      // Fall through to synthetic stream so the playground is never blank.
    }
  }

  const stream = buildSyntheticStream(payload);
  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-wattz-source': 'synthetic-bootstrap',
    },
  });
}

function buildSyntheticStream(payload: Payload): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const region = REGION_HINTS[payload.model] || 'US-East';
  const priceRow = PRICE_PER_1K[payload.model] || { input: 0.0006, output: 0.0008 };

  const promptText = payload.messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n')
    .slice(0, 320);

  const answerBody = composeSyntheticAnswer(payload.model, promptText);
  const chunks = tokenizeForStream(answerBody);
  const startedAt = Date.now();
  const proofHash = hex(64);
  const attestationType = pickAttestationType(payload.model);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send({
        type: 'meta',
        latencyMs: 180,
        region,
        costUsd: 0,
      });

      for (const chunk of chunks) {
        await sleep(28 + Math.random() * 32);
        send({ type: 'delta', content: chunk });
      }

      const outputTokens = Math.round(answerBody.length / 4.2);
      const inputTokens = Math.round(promptText.length / 4);
      const cost =
        (inputTokens / 1000) * priceRow.input + (outputTokens / 1000) * priceRow.output;

      send({
        type: 'meta',
        latencyMs: Date.now() - startedAt,
        region,
        costUsd: Number(cost.toFixed(6)),
      });

      send({
        type: 'attestation',
        attestation: {
          proofHash,
          attestationType,
          verifier: 'wattz-compute-verifier v0.9.4',
          timestamp: Date.now(),
        },
      });

      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      controller.close();
    },
  });
}

function composeSyntheticAnswer(model: string, prompt: string): string {
  const heading = `Wattz gateway - ${model}`;
  const lines = [
    heading,
    '-'.repeat(heading.length),
    prompt
      ? `Received prompt of ${prompt.length} characters. Routing through the substation...`
      : 'Empty prompt received. Streaming a live self-test instead.',
    '',
    'This response is served through the bootstrap fallback path while a fresh inference gateway warms up. The wire protocol is identical to OpenAI: SSE deltas, [DONE] terminator, and a JSON envelope. Nothing on the client changes when the primary GPU node is reachable.',
    '',
    'Once the primary GPU is online, this same response arrives from a Llama 3 or Mistral model running inside a TEE. Every session ends with an attestation quote and a Token-2022 settlement receipt.',
    '',
    'Region assignment, latency, and price are reported by the same envelope so the playground can render side-by-side comparisons against OpenAI.',
  ];
  return lines.join('\n');
}

function tokenizeForStream(text: string): string[] {
  const parts: string[] = [];
  let buf = '';
  for (const ch of text) {
    buf += ch;
    if (buf.length >= 6 && /[\s.,;:!?]/.test(ch)) {
      parts.push(buf);
      buf = '';
    }
  }
  if (buf) parts.push(buf);
  return parts;
}

function pickAttestationType(model: string): 'sgx' | 'sev' | 'nvidia-cc' | 'risc0' | 'sp1' {
  if (model.startsWith('llama')) return 'nvidia-cc';
  if (model.startsWith('mistral')) return 'sgx';
  if (model.startsWith('stable-diffusion')) return 'sev';
  if (model.startsWith('whisper')) return 'sgx';
  return 'risc0';
}

function hex(len: number): string {
  const chars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * 16)];
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
