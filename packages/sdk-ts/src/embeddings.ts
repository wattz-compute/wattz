import type { WattzClient } from './client';
import type { EmbeddingRequest, EmbeddingResponse, RequestOverrides } from './types';

/**
 * Embeddings namespace. `POST /v1/embeddings` on the Wattz gateway is a
 * strict superset of the OpenAI schema, with an added `wattz` metadata
 * envelope revealing the serving node and attestation.
 */
export class Embeddings {
  constructor(private readonly client: WattzClient) {}

  create(
    params: EmbeddingRequest,
    options: RequestOverrides = {},
  ): Promise<EmbeddingResponse> {
    return this.client.request<EmbeddingResponse>({
      method: 'POST',
      path: '/embeddings',
      body: params,
      signal: options.signal,
      headers: options.headers,
      timeoutMs: options.timeout,
    });
  }
}
