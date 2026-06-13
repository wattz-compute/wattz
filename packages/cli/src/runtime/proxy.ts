import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { randomBytes } from 'node:crypto';

interface ProxyOptions {
  bind: string;
  ollamaEndpoint: string;
  model: string;
  operator: string;
  region: string;
  attestationHash: string;
  attestationKind: 'sgx' | 'sev' | 'nvidia_cc' | 'none';
  onRequest?: (info: { model: string; tokens: number; latencyMs: number }) => void;
}

export interface ProxyHandle {
  listen(): Promise<{ host: string; port: number }>;
  close(): Promise<void>;
}

/**
 * Local OpenAI-compatible HTTP proxy. Translates requests hitting
 * `/v1/chat/completions` on the operator's node into Ollama `/api/chat`
 * calls and mirrors the OpenAI chunk shape back over SSE.
 */
export function createNodeProxy(opts: ProxyOptions): ProxyHandle {
  const server = createServer(async (req, res) => {
    try {
      await handle(req, res, opts);
    } catch (err) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            error: {
              message: err instanceof Error ? err.message : String(err),
              type: 'proxy_error',
            },
          }),
        );
      } else {
        res.end();
      }
    }
  });

  const [host, portStr] = splitBind(opts.bind);
  const port = Number.parseInt(portStr, 10);

  return {
    listen(): Promise<{ host: string; port: number }> {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve({ host, port });
        });
      });
    },
    close(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

function splitBind(bind: string): [string, string] {
  const idx = bind.lastIndexOf(':');
  if (idx === -1) throw new Error(`Invalid bind address: ${bind}`);
  return [bind.slice(0, idx), bind.slice(idx + 1)];
}

async function handle(req: IncomingMessage, res: ServerResponse, opts: ProxyOptions) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/healthz') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        status: 'ok',
        operator: opts.operator,
        model: opts.model,
        region: opts.region,
        attestation: opts.attestationKind,
      }),
    );
    return;
  }

  if (req.method === 'GET' && url.pathname === '/v1/models') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        object: 'list',
        data: [
          {
            id: opts.model,
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: opts.operator,
          },
        ],
      }),
    );
    return;
  }

  if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
    const body = await readJson(req);
    await proxyChat(res, body, opts);
    return;
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      error: { message: 'Not found', type: 'not_found' },
    }),
  );
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw.length > 0 ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

interface OllamaChatChunk {
  message?: { role?: string; content?: string };
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

async function proxyChat(
  res: ServerResponse,
  body: Record<string, unknown>,
  opts: ProxyOptions,
): Promise<void> {
  const stream = Boolean(body.stream);
  const requestedModel = (body.model as string | undefined) ?? opts.model;
  const startedAt = Date.now();

  const ollamaBody = {
    model: requestedModel,
    messages: (body.messages as Array<{ role: string; content: string }> | undefined) ?? [],
    stream,
    options: sanitizeOptions(body),
  };

  const upstream = await fetch(`${opts.ollamaEndpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ollamaBody),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: {
          message: `Upstream Ollama error (${upstream.status}): ${text.slice(0, 200)}`,
          type: 'upstream_error',
        },
      }),
    );
    return;
  }

  const completionId = `chatcmpl-${randomBytes(9).toString('base64url')}`;
  const created = Math.floor(Date.now() / 1000);

  if (!stream) {
    const data = (await upstream.json()) as OllamaChatChunk;
    const usage = {
      prompt_tokens: data.prompt_eval_count ?? 0,
      completion_tokens: data.eval_count ?? 0,
      total_tokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
    };
    const completion = {
      id: completionId,
      object: 'chat.completion',
      created,
      model: requestedModel,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: data.message?.content ?? '',
          },
          finish_reason: data.done_reason ?? 'stop',
        },
      ],
      usage,
      wattz: {
        node_pubkey: opts.operator,
        operator: opts.operator,
        region: opts.region,
        attestation_kind: opts.attestationKind,
        attestation_hash: opts.attestationHash,
        price_lamports: 0,
      },
    };
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(completion));
    opts.onRequest?.({
      model: requestedModel,
      tokens: usage.total_tokens,
      latencyMs: Date.now() - startedAt,
    });
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  if (!upstream.body) {
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  const reader = (upstream.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let totalPrompt = 0;
  let totalCompletion = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx = buffer.indexOf('\n');
      while (idx !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line.length === 0) {
          idx = buffer.indexOf('\n');
          continue;
        }
        let parsed: OllamaChatChunk;
        try {
          parsed = JSON.parse(line) as OllamaChatChunk;
        } catch {
          idx = buffer.indexOf('\n');
          continue;
        }
        totalPrompt = parsed.prompt_eval_count ?? totalPrompt;
        totalCompletion = parsed.eval_count ?? totalCompletion;
        const delta: Record<string, string> = {};
        if (parsed.message?.role) delta.role = parsed.message.role;
        if (parsed.message?.content) delta.content = parsed.message.content;
        const chunk = {
          id: completionId,
          object: 'chat.completion.chunk',
          created,
          model: requestedModel,
          choices: [
            {
              index: 0,
              delta,
              finish_reason: parsed.done ? (parsed.done_reason ?? 'stop') : null,
            },
          ],
          wattz: parsed.done
            ? {
                node_pubkey: opts.operator,
                operator: opts.operator,
                region: opts.region,
                attestation_kind: opts.attestationKind,
                attestation_hash: opts.attestationHash,
                price_lamports: 0,
              }
            : undefined,
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        if (parsed.done) {
          res.write('data: [DONE]\n\n');
          res.end();
          opts.onRequest?.({
            model: requestedModel,
            tokens: totalPrompt + totalCompletion,
            latencyMs: Date.now() - startedAt,
          });
          return;
        }
        idx = buffer.indexOf('\n');
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // reader already released
    }
  }
}

function sanitizeOptions(body: Record<string, unknown>): Record<string, unknown> {
  const opts: Record<string, unknown> = {};
  if (typeof body.temperature === 'number') opts.temperature = body.temperature;
  if (typeof body.top_p === 'number') opts.top_p = body.top_p;
  if (typeof body.max_tokens === 'number') opts.num_predict = body.max_tokens;
  if (typeof body.seed === 'number') opts.seed = body.seed;
  if (typeof body.frequency_penalty === 'number') opts.frequency_penalty = body.frequency_penalty;
  if (typeof body.presence_penalty === 'number') opts.presence_penalty = body.presence_penalty;
  return opts;
}
