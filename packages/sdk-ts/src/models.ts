import type { WattzClient } from './client';
import type {
  ModelInfo,
  ModelListResponse,
  RequestOverrides,
  ModelModality,
  ModelFamily,
} from './types';

export interface ModelListQuery {
  family?: ModelFamily;
  modality?: ModelModality;
  commercial?: boolean;
  min_context?: number;
}

/**
 * Models namespace. `GET /v1/models` returns every model registered in the
 * Wattz PDA model registry (Llama, GPT-OSS, Stable Diffusion XL, Whisper,
 * etc.) with license and price metadata.
 */
export class Models {
  constructor(private readonly client: WattzClient) {}

  list(query: ModelListQuery = {}, options: RequestOverrides = {}): Promise<ModelListResponse> {
    return this.client.request<ModelListResponse>({
      method: 'GET',
      path: '/models',
      query: {
        family: query.family,
        modality: query.modality,
        commercial: query.commercial,
        min_context: query.min_context,
      },
      signal: options.signal,
      headers: options.headers,
      timeoutMs: options.timeout,
    });
  }

  retrieve(id: string, options: RequestOverrides = {}): Promise<ModelInfo> {
    return this.client.request<ModelInfo>({
      method: 'GET',
      path: `/models/${encodeURIComponent(id)}`,
      signal: options.signal,
      headers: options.headers,
      timeoutMs: options.timeout,
    });
  }
}
