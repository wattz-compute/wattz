/**
 * Model registry projection consumed by the routing engine.
 *
 * The full model registry lives on-chain (see @wattz/model-registry). The
 * routing engine caches a projection of the fields it needs so a routing
 * decision is a pure in-memory lookup.
 */

export interface ModelDescriptor {
  /** OpenAI-compatible model id (`llama-3-8b-instruct` etc.). */
  id: string;
  /** Display name for the operator dashboard. */
  displayName: string;
  /** Model family (`llama`, `mistral`, `whisper`, `stable-diffusion`, `custom`). */
  family: string;
  /** Weights license identifier. */
  license: string;
  /** True if the license requires the caller to be KYC'd. */
  kycRequired: boolean;
  /** Context window in tokens. */
  contextWindow: number;
  /** VRAM footprint in mebibytes at fp16. */
  vramMib: number;
}
