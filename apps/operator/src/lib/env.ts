/**
 * Server-side env helpers. Do NOT import into client components.
 * The gateway URL is server-only so we can inject an API key at proxy
 * time without exposing it to the browser.
 */

export function gatewayBaseURL(): string {
  return (
    process.env.INFERENCE_GATEWAY_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:8080/v1'
  ).replace(/\/+$/, '');
}

export function gatewayApiKey(): string | undefined {
  return process.env.WATTZ_API_KEY;
}

export interface ProxyResult<T> {
  ok: true;
  data: T;
}

export interface ProxyError {
  ok: false;
  status: number;
  message: string;
}

export async function proxyJson<T>(path: string, init?: RequestInit): Promise<ProxyResult<T> | ProxyError> {
  const base = gatewayBaseURL();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const apiKey = gatewayApiKey();
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        message: `Upstream ${res.status} ${res.statusText}`,
      };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      status: 503,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
