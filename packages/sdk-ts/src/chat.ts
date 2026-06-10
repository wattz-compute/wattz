import type { WattzClient } from './client';
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionRequest,
  RequestOverrides,
} from './types';
import { parseSSEChunks } from './stream';

type NonStreamRequest = Omit<ChatCompletionRequest, 'stream'> & { stream?: false };
type StreamRequest = Omit<ChatCompletionRequest, 'stream'> & { stream: true };

/**
 * Chat namespace, matching `openai.chat` on the OpenAI SDK. The single
 * accessor `completions` mirrors the upstream shape so `wattz.chat.completions.create(...)`
 * is a drop-in swap.
 */
export class Chat {
  readonly completions: ChatCompletions;

  constructor(client: WattzClient) {
    this.completions = new ChatCompletions(client);
  }
}

export class ChatCompletions {
  constructor(private readonly client: WattzClient) {}

  create(params: NonStreamRequest, options?: RequestOverrides): Promise<ChatCompletion>;
  create(params: StreamRequest, options?: RequestOverrides): AsyncIterable<ChatCompletionChunk>;
  create(
    params: ChatCompletionRequest,
    options: RequestOverrides = {},
  ): AsyncIterable<ChatCompletionChunk> | Promise<ChatCompletion> {
    if (params.stream) {
      return this.stream(params, options);
    }
    return this.client.request<ChatCompletion>({
      method: 'POST',
      path: '/chat/completions',
      body: { ...params, stream: false },
      signal: options.signal,
      headers: options.headers,
      timeoutMs: options.timeout,
    });
  }

  private stream(
    params: ChatCompletionRequest,
    options: RequestOverrides,
  ): AsyncIterable<ChatCompletionChunk> {
    const client = this.client;
    const body = { ...params, stream: true };
    async function* iterator(): AsyncGenerator<ChatCompletionChunk, void, unknown> {
      const res = await client.rawRequest({
        method: 'POST',
        path: '/chat/completions',
        body,
        stream: true,
        signal: options.signal,
        headers: options.headers,
        timeoutMs: options.timeout,
      });
      if (!res.body) return;
      const stream = res.body as ReadableStream<Uint8Array>;
      yield* parseSSEChunks<ChatCompletionChunk>(stream);
    }
    return {
      [Symbol.asyncIterator]: () => iterator(),
    };
  }
}
