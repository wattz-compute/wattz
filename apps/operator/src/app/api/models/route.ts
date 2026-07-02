import { NextResponse } from 'next/server';
import { proxyJson } from '@/lib/env';
import { baselineModelList } from '@/lib/baseline';
import type { ModelInfo, ModelStatus } from '@/types/wattz';

export const dynamic = 'force-dynamic';

/**
 * Shape the gateway actually serializes for /v1/models (see
 * packages/inference-gateway/src/openai/types.rs ModelObject). It differs from
 * the operator ModelInfo: `license` is a bare string, context is `max_context`,
 * node count is `serving_nodes`, and price/family/modality/vram are absent.
 */
interface GatewayModelObject {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  display_name?: string;
  license: string;
  max_context?: number;
  kyc_required?: boolean;
  serving_nodes?: number;
  status?: string;
}

export async function GET() {
  const result = await proxyJson<{ object: 'list'; data: GatewayModelObject[] }>('/models');
  if (result.ok && result.data.data.length > 0) {
    // The baseline carries the canonical price/family/modality/vram metadata per
    // model id; merge the live gateway row onto it so the columns stay populated
    // with correct values while status/serving_nodes/context reflect the gateway.
    const baseline = new Map(baselineModelList().data.map((m) => [m.id, m]));
    const mapped: ModelInfo[] = result.data.data.map((m) => {
      const base = baseline.get(m.id);
      return {
        id: m.id,
        object: 'model',
        created: m.created,
        owned_by: m.owned_by,
        family: base?.family,
        version: base?.version,
        publisher: base?.publisher,
        modality: base?.modality,
        license: { name: m.license, kyc_required: m.kyc_required ?? base?.license.kyc_required },
        context_window: m.max_context ?? base?.context_window ?? 0,
        price_per_1k_prompt: base?.price_per_1k_prompt ?? 0,
        price_per_1k_completion: base?.price_per_1k_completion ?? 0,
        min_gpu_vram_gb: base?.min_gpu_vram_gb ?? 0,
        nodes_online: m.serving_nodes ?? base?.nodes_online ?? 0,
        status: (m.status as ModelStatus | undefined) ?? base?.status,
      };
    });
    return NextResponse.json({ object: 'list', data: mapped });
  }
  // Unreachable gateway or an empty registry: show the labelled launch model set.
  return NextResponse.json(baselineModelList());
}
