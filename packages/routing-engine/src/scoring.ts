/**
 * Deterministic scoring engine.
 *
 * `scoreNode` returns a value in `[0, 1]` (higher = better). The final
 * score is a weighted sum of four components:
 *
 *   - price      (lower is better)
 *   - latency    (lower is better)
 *   - reputation (higher is better)
 *   - attestation (categorical bonus for TEE)
 *
 * Weights are configurable so a routing profile can prioritise privacy
 * (attestation weight up) or cost (price weight up).
 */

import type { NodeRecord } from "./nodes.js";

export interface ScoreWeights {
  price: number;
  latency: number;
  reputation: number;
  attestation: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  price: 0.35,
  latency: 0.25,
  reputation: 0.25,
  attestation: 0.15,
};

/** Scoring input: contextual reference values used to normalise. */
export interface ScoreContext {
  /** Highest per-1k-token price observed in the current candidate pool. */
  maxPriceMicros: number;
  /** Highest p50 latency observed in the current candidate pool. */
  maxLatencyMs: number;
}

export function attestationBonus(kind: string): number {
  switch (kind) {
    case "sgx":
    case "sev-snp":
    case "nvidia-cc":
      return 1.0;
    case "software":
      return 0.0;
    default:
      return 0.25;
  }
}

export function scoreNode(
  node: NodeRecord,
  ctx: ScoreContext,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): number {
  const priceScore =
    ctx.maxPriceMicros <= 0
      ? 1
      : 1 - clamp01(node.pricePer1kOutputMicros / ctx.maxPriceMicros);
  const latencyScore =
    ctx.maxLatencyMs <= 0
      ? 1
      : 1 - clamp01(node.latencyP50Ms / ctx.maxLatencyMs);
  const reputationScore = clamp01(node.reputation);
  const attScore = attestationBonus(node.attestation.type);
  return (
    weights.price * priceScore +
    weights.latency * latencyScore +
    weights.reputation * reputationScore +
    weights.attestation * attScore
  );
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}
