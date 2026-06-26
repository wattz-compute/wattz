import type { ModelInfo, NodeInfo } from '@/types/wattz';

export interface OperatorStats {
  operator?: string;
  online_nodes: number;
  total_nodes: number;
  aggregate_tflops: number;
  daily_inferences: number;
  daily_tokens: number;
  daily_revenue_lamports: number;
  cumulative_revenue_lamports: number;
  pending_rewards_lamports: number;
  updated_at: number;
}

export interface RewardsSnapshot {
  operator: string;
  pending_lamports: number;
  claimed_lamports: number;
  last_claim_at?: number;
  revenue_series: RevenuePoint[];
}

export interface RevenuePoint {
  timestamp: number;
  revenue_lamports: number;
  requests: number;
  tokens: number;
}

export interface UptimePoint {
  timestamp: number;
  uptime_pct: number;
  requests: number;
}

export interface NodeDetail extends NodeInfo {
  uptime_series: UptimePoint[];
  revenue_series: RevenuePoint[];
  models_loaded: string[];
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    let message = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error?.message) message = body.error.message as string;
    } catch {
      // ignore parse failure
    }
    const err = new Error(message);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

export const api = {
  stats: (operator?: string) =>
    fetchJson<OperatorStats>(operator ? `/api/stats?operator=${operator}` : '/api/stats'),
  nodes: (operator?: string) =>
    fetchJson<{ object: 'list'; data: NodeInfo[] }>(
      operator ? `/api/nodes?operator=${operator}` : '/api/nodes',
    ),
  node: (id: string) => fetchJson<NodeDetail>(`/api/nodes/${encodeURIComponent(id)}`),
  models: () => fetchJson<{ object: 'list'; data: ModelInfo[] }>('/api/models'),
  rewards: (operator: string) => fetchJson<RewardsSnapshot>(`/api/rewards?operator=${operator}`),
};
