export interface ModelInfo {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  license?: string;
  kyc_gated?: boolean;
  price_per_1k_tokens?: number;
  modality?: 'text' | 'image' | 'audio' | 'embedding';
  nodes_online?: number;
}

export interface ModelListResponse {
  object: 'list';
  data: ModelInfo[];
}

export interface NodeInfo {
  pubkey: string;
  authority: string;
  gpu_model: string;
  region: string;
  endpoint: string;
  stake_amount: number;
  reputation: number;
  uptime_last_ping?: number;
  models_supported: string[];
  pending_rewards: number;
  slashed: boolean;
}

export interface NodeListResponse {
  object: 'list';
  data: NodeInfo[];
}
