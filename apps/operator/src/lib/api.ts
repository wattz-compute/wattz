import type { ModelListResponse, NodeInfo, NodeListResponse } from '@/types/wattz';

export type PayloadSource = 'network-preview';

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
  source?: PayloadSource;
}

export interface RewardsSnapshot {
  operator: string;
  pending_lamports: number;
  claimed_lamports: number;
  last_claim_at?: number;
  revenue_series: RevenuePoint[];
  source?: PayloadSource;
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

export interface StatsHistoryPoint {
  timestamp: number;
  inferences: number;
  tokens: number;
  revenue_lamports: number;
}

export interface StatsHistoryResponse {
  object: 'list';
  data: StatsHistoryPoint[];
  source?: PayloadSource;
}

export interface NodeEvent {
  timestamp: number;
  kind: string;
  message: string;
}

export interface NodeDetail extends NodeInfo {
  uptime_series: UptimePoint[];
  revenue_series: RevenuePoint[];
  models_loaded: string[];
  first_seen?: number;
  price_multiplier?: number;
  events?: NodeEvent[];
  source?: PayloadSource;
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
    fetchJson<OperatorStats>(
      operator ? `/api/stats?operator=${encodeURIComponent(operator)}` : '/api/stats',
    ),
  statsHistory: () => fetchJson<StatsHistoryResponse>('/api/stats/history'),
  nodes: (operator?: string) =>
    fetchJson<NodeListResponse>(
      operator ? `/api/nodes?operator=${encodeURIComponent(operator)}` : '/api/nodes',
    ),
  node: (id: string) => fetchJson<NodeDetail>(`/api/nodes/${encodeURIComponent(id)}`),
  models: () => fetchJson<ModelListResponse>('/api/models'),
  rewards: (operator: string) =>
    fetchJson<RewardsSnapshot>(`/api/rewards?operator=${encodeURIComponent(operator)}`),
};
