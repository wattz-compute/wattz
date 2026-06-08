import {
  API_KEY_ENV,
  BASE_URL_ENV,
  DEFAULT_BASE_URL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  USER_AGENT,
} from './constants';
import type { ClientOptions } from './types';
import {
  apiErrorFromStatus,
  WattzAPIError,
  WattzConnectionError,
  WattzRateLimitError,
  WattzTimeoutError,
} from './errors';
import { Chat } from './chat';
import { Embeddings } from './embeddings';
import { Images } from './images';
import { Models } from './models';
import { Nodes } from './nodes';

interface RawRequestOptions {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  stream?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * WattzClient is the entry point for the TypeScript SDK. The public API is
 * intentionally shaped like the OpenAI Node SDK so an existing project can
 * migrate by swapping the constructor and `baseURL`.
 *
 * @example
 * ```ts
 * import { WattzClient } from '@wattz/sdk';
 *
 * const wattz = new WattzClient({ apiKey: process.env.WATTZ_API_KEY });
 * const res = await wattz.chat.completions.create({
 *   model: 'llama-3-8b-instruct',
 *   messages: [{ role: 'user', content: 'Explain TEE attestation in one line.' }],
 * });
 * console.log(res.choices[0].message.content);
 * ```
 */
export class WattzClient {
  private readonly apiKey: string | undefined;
  readonly baseURL: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly defaultHeaders: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  readonly chat: Chat;
  readonly embeddings: Embeddings;
  readonly images: Images;
  readonly models: Models;
  readonly nodes: Nodes;

  constructor(options: ClientOptions = {}) {
    const envApiKey =
      typeof process !== 'undefined' && process.env
        ? process.env[API_KEY_ENV]
        : undefined;
    const envBaseURL =
      typeof process !== 'undefined' && process.env
        ? process.env[BASE_URL_ENV]
        : undefined;

    this.apiKey = options.apiKey ?? envApiKey;
    const rawBase = options.baseURL ?? envBaseURL ?? DEFAULT_BASE_URL;
    this.baseURL = rawBase.replace(/\/+$/, '');
    this.timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.defaultHeaders = { ...(options.defaultHeaders ?? {}) };

    const fetchImpl =
      options.fetch ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);
    if (!fetchImpl) {
      throw new WattzConnectionError(
        'Global fetch is unavailable. Provide options.fetch or run on Node 18+.',
      );
    }
    this.fetchImpl = fetchImpl;

    this.chat = new Chat(this);
    this.embeddings = new Embeddings(this);
    this.images = new Images(this);
    this.models = new Models(this);
    this.nodes = new Nodes(this);
  }

  /**
   * Perform a JSON request. Non-2xx responses raise a `WattzAPIError`
   * subclass. Retries are applied to 429 and 5xx statuses up to
   * `maxRetries`.
   */
  async request<T>(opts: RawRequestOptions): Promise<T> {
    if (opts.stream) {
      throw new Error('WattzClient.request called with stream:true. Use rawRequest.');
    }
    const res = await this.rawRequest(opts);
    const text = await res.text();
    if (text.length === 0) return undefined as unknown as T;
    return JSON.parse(text) as T;
  }

  /**
   * Low-level entry point. Returns the raw `Response` for streaming callers.
   */
  async rawRequest(opts: RawRequestOptions): Promise<Response> {
    const url = this.buildURL(opts.path, opts.query);
    const headers: Record<string, string> = {
      Accept: opts.stream ? 'text/event-stream' : 'application/json',
      'User-Agent': USER_AGENT,
      'X-Wattz-Client': 'wattz-sdk-js',
      ...this.defaultHeaders,
      ...(opts.headers ?? {}),
    };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    let bodyStr: string | undefined;
    if (opts.body !== undefined) {
      bodyStr = JSON.stringify(opts.body);
      headers['Content-Type'] = 'application/json';
    }

    const timeoutMs = opts.timeoutMs ?? this.timeoutMs;
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const abortForTimeout = () => controller.abort(new WattzTimeoutError(timeoutMs));
      const timer = setTimeout(abortForTimeout, timeoutMs);
      const external = opts.signal;
      const forwardAbort = () => controller.abort(external?.reason);
      if (external) {
        if (external.aborted) {
          clearTimeout(timer);
          throw external.reason ?? new WattzConnectionError('Request aborted before dispatch');
        }
        external.addEventListener('abort', forwardAbort);
      }

      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          method: opts.method,
          headers,
          body: bodyStr,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        if (external) external.removeEventListener('abort', forwardAbort);
        const reason = controller.signal.reason;
        if (reason instanceof WattzTimeoutError) {
          if (attempt < this.maxRetries) {
            await sleep(backoffMs(attempt));
            lastError = reason;
            continue;
          }
          throw reason;
        }
        if (external?.aborted) {
          throw external.reason ?? new WattzConnectionError('Request aborted');
        }
        if (attempt < this.maxRetries) {
          await sleep(backoffMs(attempt));
          lastError = err;
          continue;
        }
        throw new WattzConnectionError(err);
      }

      clearTimeout(timer);
      if (external) external.removeEventListener('abort', forwardAbort);

      if (res.ok) {
        return res;
      }

      const requestId = res.headers.get('x-request-id') ?? undefined;
      const retryAfterRaw = res.headers.get('retry-after');
      const retryAfterMs = retryAfterRaw ? Number(retryAfterRaw) * 1000 : undefined;
      const errText = await res.text();
      let parsed: unknown;
      try {
        parsed = errText.length > 0 ? JSON.parse(errText) : undefined;
      } catch {
        parsed = { message: errText };
      }

      const shouldRetry =
        attempt < this.maxRetries && (res.status === 429 || res.status >= 500);
      if (shouldRetry) {
        const backoff =
          res.status === 429 && retryAfterMs && retryAfterMs > 0
            ? retryAfterMs
            : backoffMs(attempt);
        await sleep(backoff);
        lastError = apiErrorFromStatus(res.status, parsed as never, requestId, retryAfterMs);
        continue;
      }

      if (res.status === 429) {
        throw new WattzRateLimitError(parsed as never, retryAfterMs, requestId);
      }
      throw apiErrorFromStatus(res.status, parsed as never, requestId, retryAfterMs);
    }

    if (lastError instanceof WattzAPIError || lastError instanceof WattzTimeoutError) {
      throw lastError;
    }
    throw new WattzConnectionError(lastError ?? 'Exceeded retry budget');
  }

  private buildURL(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseURL}${normalized}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  const base = 400 * 2 ** attempt;
  const jitter = Math.random() * 200;
  return Math.min(base + jitter, 8000);
}
