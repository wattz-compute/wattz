import type { WattzClient } from './client';
import type { ImageRequest, ImageResponse, RequestOverrides } from './types';

/**
 * Images namespace, mapping to `POST /v1/images/generations`. The default
 * model on Wattz is `stable-diffusion-xl-base`; SDXL, SD 1.5, and Flux
 * variants are also routable by id.
 */
export class Images {
  constructor(private readonly client: WattzClient) {}

  generate(
    params: ImageRequest,
    options: RequestOverrides = {},
  ): Promise<ImageResponse> {
    return this.client.request<ImageResponse>({
      method: 'POST',
      path: '/images/generations',
      body: params,
      signal: options.signal,
      headers: options.headers,
      timeoutMs: options.timeout,
    });
  }
}
