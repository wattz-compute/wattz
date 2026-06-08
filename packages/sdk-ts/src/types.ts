/**
 * Public type definitions for the Wattz SDK. The wire format is a strict
 * superset of the OpenAI chat/completions, embeddings, and images schemas
 * with an extra `wattz` object surfacing attestation and settlement data.
 */

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  tool_call_id?: string;
}

export type AttestationKind = 'sgx' | 'sev' | 'nvidia_cc' | 'risc0' | 'sp1' | 'none';

export interface WattzMetadata {
  node_pubkey: string;
  operator: string;
  region: string;
  attestation_kind: AttestationKind;
  attestation_hash: string;
  price_lamports: number;
  settlement_signature?: string;
  registry_pda?: string;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export type FinishReason =
  | 'stop'
  | 'length'
  | 'content_filter'
  | 'tool_calls'
  | null;

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  user?: string;
  seed?: number;
  /** Preferred region label, e.g. `us-east-1` or `auto`. */
  region?: string;
  /** Max price the client will accept per 1k completion tokens, in lamports. */
  max_price_per_1k?: number;
  /** Require the routing engine to select TEE-attested nodes only. */
  require_tee?: boolean;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: FinishReason;
}

export interface ChatCompletion {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: Usage;
  wattz?: WattzMetadata;
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: Partial<ChatMessage>;
  finish_reason: FinishReason;
}

export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
  wattz?: WattzMetadata;
}

export interface EmbeddingRequest {
  model: string;
  input: string | string[];
  encoding_format?: 'float' | 'base64';
  dimensions?: number;
  user?: string;
}

export interface Embedding {
  index: number;
  object: 'embedding';
  embedding: number[];
}

export interface EmbeddingResponse {
  object: 'list';
  data: Embedding[];
  model: string;
  usage: Pick<Usage, 'prompt_tokens' | 'total_tokens'>;
  wattz?: WattzMetadata;
}

export interface ImageRequest {
  model: string;
  prompt: string;
  n?: number;
  size?: '256x256' | '512x512' | '1024x1024' | '1024x1792' | '1792x1024' | string;
  response_format?: 'url' | 'b64_json';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  user?: string;
}

export interface ImageDatum {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}

export interface ImageResponse {
  created: number;
  data: ImageDatum[];
  wattz?: WattzMetadata;
}

export interface ModelLicense {
  spdx?: string;
  name: string;
  commercial: boolean;
  kyc_required: boolean;
  upstream_url?: string;
}

export type ModelModality = 'text' | 'image' | 'audio' | 'embedding';

export type ModelFamily =
  | 'llama'
  | 'mistral'
  | 'qwen'
  | 'phi'
  | 'stable-diffusion'
  | 'whisper'
  | 'gemma'
  | 'gpt-oss'
  | 'other';

export interface ModelInfo {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  family: ModelFamily;
  parameters_b: number;
  context_window: number;
  modality: ModelModality;
  license: ModelLicense;
  registry_pda: string;
  price_per_1k_prompt: number;
  price_per_1k_completion: number;
  supported_regions: string[];
  min_gpu_vram_gb: number;
}

export interface ModelListResponse {
  object: 'list';
  data: ModelInfo[];
}

export interface NodeInfo {
  pubkey: string;
  operator: string;
  region: string;
  gpus: string[];
  online: boolean;
  uptime_pct: number;
  tflops_active: number;
  attestation_kind: AttestationKind;
  supported_models: string[];
  reputation: number;
  stake_lamports: number;
  first_seen: number;
  last_heartbeat: number;
  price_multiplier: number;
}

export interface NodeListResponse {
  object: 'list';
  data: NodeInfo[];
}

export interface ClientOptions {
  /** Bearer API key. Falls back to `process.env.WATTZ_API_KEY`. */
  apiKey?: string;
  /** Override the API base URL. Defaults to `https://api.wattz.fi/v1`. */
  baseURL?: string;
  /** Request timeout in milliseconds. Defaults to 60000. */
  timeout?: number;
  /** Number of retries for 429 and 5xx responses. Defaults to 2. */
  maxRetries?: number;
  /** Extra headers merged into every request. */
  defaultHeaders?: Record<string, string>;
  /** Custom fetch implementation. Defaults to the global fetch. */
  fetch?: typeof fetch;
}

export interface RequestOverrides {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  timeout?: number;
}
