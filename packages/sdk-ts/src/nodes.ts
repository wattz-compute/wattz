import type { WattzClient } from './client';
import type { NodeInfo, NodeListResponse, RequestOverrides } from './types';

export interface NodeListQuery {
  region?: string;
  model?: string;
  online?: boolean;
  attestation?: 'sgx' | 'sev' | 'nvidia_cc';
  min_reputation?: number;
}

/**
 * Nodes namespace. `GET /v1/nodes` returns the current GPU node fleet with
 * uptime, TFLOPS, stake, and attestation type. Operators can list their
 * own node via `retrieve(pubkey)`.
 */
export class Nodes {
  constructor(private readonly client: WattzClient) {}

  list(query: NodeListQuery = {}, options: RequestOverrides = {}): Promise<NodeListResponse> {
    return this.client.request<NodeListResponse>({
      method: 'GET',
      path: '/nodes',
      query: {
        region: query.region,
        model: query.model,
        online: query.online,
        attestation: query.attestation,
        min_reputation: query.min_reputation,
      },
      signal: options.signal,
      headers: options.headers,
      timeoutMs: options.timeout,
    });
  }

  retrieve(pubkey: string, options: RequestOverrides = {}): Promise<NodeInfo> {
    return this.client.request<NodeInfo>({
      method: 'GET',
      path: `/nodes/${encodeURIComponent(pubkey)}`,
      signal: options.signal,
      headers: options.headers,
      timeoutMs: options.timeout,
    });
  }
}
