import { describe, expect, it, vi } from 'vitest';
import { WattzClient } from '../src/client';
import { WattzAPIError, WattzAuthenticationError, WattzRateLimitError } from '../src/errors';
import { parseSSEChunks } from '../src/stream';

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  const status = init.status ?? 200;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

function sseResponse(events: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('WattzClient', () => {
  it('normalizes baseURL and sends bearer authentication', async () => {
    const captured: { url?: string; init?: RequestInit } = {};
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      captured.url = url;
      captured.init = init;
      return jsonResponse({ ok: true });
    });
    const client = new WattzClient({
      apiKey: 'sk_test',
      baseURL: 'https://api.wattz.fi/v1/',
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(client.baseURL).toBe('https://api.wattz.fi/v1');
    await client.request({ method: 'GET', path: '/models' });
    expect(captured.url).toBe('https://api.wattz.fi/v1/models');
    const headers = captured.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk_test');
    expect(headers['User-Agent']).toMatch(/wattz-sdk-js/);
  });

  it('appends query params only when defined', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe('https://api.wattz.fi/v1/nodes?region=us-east-1&online=true');
      return jsonResponse({ object: 'list', data: [] });
    });
    const client = new WattzClient({
      fetch: fetchMock as unknown as typeof fetch,
    });
    await client.nodes.list({ region: 'us-east-1', online: true });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('raises WattzAuthenticationError on 401', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ error: { message: 'bad key' } }, { status: 401 }),
    );
    const client = new WattzClient({
      fetch: fetchMock as unknown as typeof fetch,
      maxRetries: 0,
    });
    await expect(client.models.list()).rejects.toBeInstanceOf(WattzAuthenticationError);
  });

  it('retries on 429 respecting retry-after', async () => {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        return jsonResponse(
          { error: { message: 'slow down' } },
          { status: 429, headers: { 'retry-after': '0' } },
        );
      }
      return jsonResponse({ object: 'list', data: [] });
    });
    const client = new WattzClient({
      fetch: fetchMock as unknown as typeof fetch,
      maxRetries: 1,
    });
    const res = await client.models.list();
    expect(res.data).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces WattzRateLimitError after exhausting retries', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        { error: { message: 'nope' } },
        { status: 429, headers: { 'retry-after': '0' } },
      ),
    );
    const client = new WattzClient({
      fetch: fetchMock as unknown as typeof fetch,
      maxRetries: 1,
    });
    await expect(client.models.list()).rejects.toBeInstanceOf(WattzRateLimitError);
  });

  it('parses non-streamed chat completions', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const parsed = JSON.parse(init.body as string);
      expect(parsed.stream).toBe(false);
      return jsonResponse({
        id: 'chatcmpl-1',
        object: 'chat.completion',
        created: 1,
        model: 'llama-3-8b-instruct',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'ack' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    });
    const client = new WattzClient({
      fetch: fetchMock as unknown as typeof fetch,
    });
    const res = await client.chat.completions.create({
      model: 'llama-3-8b-instruct',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(res.choices[0]?.message.content).toBe('ack');
  });

  it('streams chat completion chunks via async iterator', async () => {
    const events = [
      'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"m","choices":[{"index":0,"delta":{"content":"He"},"finish_reason":null}]}\n\n',
      'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"m","choices":[{"index":0,"delta":{"content":"llo"},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const fetchMock = vi.fn(async () => sseResponse(events));
    const client = new WattzClient({
      fetch: fetchMock as unknown as typeof fetch,
    });
    const chunks: string[] = [];
    for await (const chunk of client.chat.completions.create({
      model: 'llama-3-8b-instruct',
      messages: [{ role: 'user', content: 'stream please' }],
      stream: true,
    })) {
      const delta = chunk.choices[0]?.delta.content ?? '';
      chunks.push(delta);
    }
    expect(chunks.join('')).toBe('Hello');
  });

  it('raises WattzAPIError on 400 without retry', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ error: { message: 'bad model' } }, { status: 400 }),
    );
    const client = new WattzClient({
      fetch: fetchMock as unknown as typeof fetch,
      maxRetries: 3,
    });
    await expect(client.models.retrieve('nope')).rejects.toBeInstanceOf(WattzAPIError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('parseSSEChunks', () => {
  it('yields JSON payloads and terminates on [DONE]', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"a":1}\n\n'));
        controller.enqueue(encoder.encode('data: {"a":2}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    const out: Array<{ a: number }> = [];
    for await (const chunk of parseSSEChunks<{ a: number }>(stream)) {
      out.push(chunk);
    }
    expect(out).toEqual([{ a: 1 }, { a: 2 }]);
  });
});
