import { DEFAULT_OLLAMA_ENDPOINT } from '../constants';

export interface OllamaModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  modified_at: string;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
    family?: string;
  };
}

export interface OllamaTagsResponse {
  models: OllamaModel[];
}

const DEFAULT_TIMEOUT = 5_000;

export async function isOllamaOnline(endpoint = DEFAULT_OLLAMA_ENDPOINT): Promise<boolean> {
  try {
    const res = await fetch(`${endpoint}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(1_500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listOllamaModels(endpoint = DEFAULT_OLLAMA_ENDPOINT): Promise<OllamaModel[]> {
  const res = await fetch(`${endpoint}/api/tags`, {
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
  });
  if (!res.ok) {
    throw new Error(`Ollama /api/tags returned HTTP ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as OllamaTagsResponse;
  return body.models ?? [];
}

export async function ollamaHasModel(
  model: string,
  endpoint = DEFAULT_OLLAMA_ENDPOINT,
): Promise<boolean> {
  const models = await listOllamaModels(endpoint);
  return models.some(
    (m) =>
      m.name === model ||
      m.model === model ||
      m.name.startsWith(`${model}:`) ||
      m.model.startsWith(`${model}:`),
  );
}

export function mapWattzModelToOllama(model: string): string {
  // The Wattz registry uses canonical model ids. Ollama uses its own tag
  // convention. This is the canonical mapping for the first six shipped
  // models. Unknown ids pass through unchanged.
  const mapping: Record<string, string> = {
    'llama-3-8b-instruct': 'llama3:8b-instruct-q4_K_M',
    'llama-3-70b-instruct': 'llama3:70b-instruct-q4_K_M',
    'llama-3.1-8b-instruct': 'llama3.1:8b-instruct-q4_K_M',
    'llama-3.1-70b-instruct': 'llama3.1:70b-instruct-q4_K_M',
    'mistral-7b-instruct-v0.3': 'mistral:7b-instruct-v0.3-q4_K_M',
    'mixtral-8x7b-instruct-v0.1': 'mixtral:8x7b-instruct-v0.1-q4_K_M',
    'qwen-2.5-7b-instruct': 'qwen2.5:7b-instruct-q4_K_M',
    'phi-3-mini-4k-instruct': 'phi3:mini-4k-instruct-q4_K_M',
    'gemma-2-9b-instruct': 'gemma2:9b-instruct-q4_K_M',
  };
  return mapping[model] ?? model;
}
