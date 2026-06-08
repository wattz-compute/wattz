/**
 * Error hierarchy raised by the Wattz SDK. All errors extend `WattzError`.
 * Network / timeout / API failures are surfaced as distinct subclasses so
 * callers can `catch` with type refinement.
 */

export class WattzError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WattzError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface APIErrorBody {
  message?: string;
  type?: string;
  code?: string;
  param?: string;
}

type NestedErrorBody = APIErrorBody | { error?: APIErrorBody } | undefined;

function unwrap(body: NestedErrorBody): APIErrorBody | undefined {
  if (!body) return undefined;
  if (typeof body === 'object' && 'error' in body && body.error) return body.error;
  return body as APIErrorBody;
}

export class WattzAPIError extends WattzError {
  readonly status: number;
  readonly code: string | undefined;
  readonly type: string | undefined;
  readonly param: string | undefined;
  readonly requestId: string | undefined;
  readonly body: unknown;

  constructor(status: number, body: NestedErrorBody, requestId?: string) {
    const inner = unwrap(body);
    const message = inner?.message ?? `Wattz API error (HTTP ${status})`;
    super(message);
    this.name = 'WattzAPIError';
    this.status = status;
    this.code = inner?.code;
    this.type = inner?.type;
    this.param = inner?.param;
    this.requestId = requestId;
    this.body = body;
  }
}

export class WattzAuthenticationError extends WattzAPIError {
  constructor(body: NestedErrorBody, requestId?: string) {
    super(401, body, requestId);
    this.name = 'WattzAuthenticationError';
  }
}

export class WattzPermissionError extends WattzAPIError {
  constructor(body: NestedErrorBody, requestId?: string) {
    super(403, body, requestId);
    this.name = 'WattzPermissionError';
  }
}

export class WattzNotFoundError extends WattzAPIError {
  constructor(body: NestedErrorBody, requestId?: string) {
    super(404, body, requestId);
    this.name = 'WattzNotFoundError';
  }
}

export class WattzRateLimitError extends WattzAPIError {
  readonly retryAfterMs: number | undefined;
  constructor(body: NestedErrorBody, retryAfterMs?: number, requestId?: string) {
    super(429, body, requestId);
    this.name = 'WattzRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class WattzServerError extends WattzAPIError {
  constructor(status: number, body: NestedErrorBody, requestId?: string) {
    super(status, body, requestId);
    this.name = 'WattzServerError';
  }
}

export class WattzTimeoutError extends WattzError {
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`Wattz request timed out after ${timeoutMs}ms`);
    this.name = 'WattzTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export class WattzConnectionError extends WattzError {
  override readonly cause: unknown;
  constructor(cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Wattz connection error: ${detail}`);
    this.name = 'WattzConnectionError';
    this.cause = cause;
  }
}

export class WattzStreamError extends WattzError {
  constructor(message: string) {
    super(`Wattz stream error: ${message}`);
    this.name = 'WattzStreamError';
  }
}

export function apiErrorFromStatus(
  status: number,
  body: NestedErrorBody,
  requestId?: string,
  retryAfterMs?: number,
): WattzAPIError {
  if (status === 401) return new WattzAuthenticationError(body, requestId);
  if (status === 403) return new WattzPermissionError(body, requestId);
  if (status === 404) return new WattzNotFoundError(body, requestId);
  if (status === 429) return new WattzRateLimitError(body, retryAfterMs, requestId);
  if (status >= 500) return new WattzServerError(status, body, requestId);
  return new WattzAPIError(status, body, requestId);
}
