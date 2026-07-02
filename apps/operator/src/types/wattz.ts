export interface ModelLicense {
  name: string;
  kyc_required?: boolean;
}

export type ModelStatus = 'live' | 'relay' | 'devnet' | 'awaiting node';

export interface ModelInfo {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  family?: string;
  version?: string;
  publisher?: string;
  modality?: 'text' | 'image' | 'audio' | 'embedding';
  license: ModelLicense;
  context_window: number;
  price_per_1k_prompt: number;
  price_per_1k_completion: number;
  min_gpu_vram_gb: number;
  nodes_online?: number;
  status?: ModelStatus;
}

export interface ModelListResponse {
  object: 'list';
  data: ModelInfo[];
  source?: 'network-preview';
}

export type AttestationKind = 'sgx' | 'sev' | 'nvidia_cc' | 'risc0' | 'sp1' | 'none';

export interface NodeInfo {
  pubkey: string;
  operator: string;
  region: string;
  online: boolean;
  uptime_pct: number;
  tflops_active: number;
  stake_lamports: number;
  reputation: number;
  attestation_kind: AttestationKind;
  gpus: string[];
  supported_models: string[];
  last_heartbeat: number;
}

export interface NodeListResponse {
  object: 'list';
  data: NodeInfo[];
  source?: 'network-preview';
}
