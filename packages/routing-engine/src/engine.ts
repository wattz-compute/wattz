/**
 * Wattz routing engine.
 *
 * The engine is stateless with respect to routing decisions; state lives
 * on the `NodePool` and the `logger`. Every routing call is a pure
 * function of (route request, node pool snapshot, weights).
 */

import pino from "pino";
import type { NodePool, NodeRecord } from "./nodes.js";
import {
  DEFAULT_WEIGHTS,
  scoreNode,
  type ScoreContext,
  type ScoreWeights,
} from "./scoring.js";

export interface RouteRequest {
  /** OpenAI model id, e.g. `llama-3-8b-instruct`. */
  model: string;
  /** Optional region preference. If unset, all regions are considered. */
  region?: string;
  /** Maximum acceptable price per 1k output tokens (micro-payment units). */
  maxPricePer1kMicros?: number;
  /** Minimum acceptable reputation (0..1). */
  minReputation?: number;
  /** Require TEE attestation. */
  requireTee?: boolean;
  /** Deterministic caller id used for tie-breaking. */
  callerId?: string;
  /** Override score weights. */
  weights?: Partial<ScoreWeights>;
}

export interface RouteDecision {
  node: NodeRecord;
  score: number;
  runnersUp: Array<{ node: NodeRecord; score: number }>;
  /** Reason the primary node was picked (for logs / dispute resolution). */
  reason: string;
}

export interface RoutingEngineOptions {
  pool: NodePool;
  logger?: pino.Logger;
  weights?: ScoreWeights;
  /** How many runner-up nodes to keep in the response for failover. */
  runnersUpCount?: number;
}

export class RoutingEngine {
  private readonly pool: NodePool;
  private readonly logger: pino.Logger;
  private readonly weights: ScoreWeights;
  private readonly runnersUpCount: number;

  constructor(options: RoutingEngineOptions) {
    this.pool = options.pool;
    this.logger =
      options.logger ??
      pino({ name: "wattz-routing", level: process.env.LOG_LEVEL ?? "info" });
    this.weights = options.weights ?? DEFAULT_WEIGHTS;
    this.runnersUpCount = options.runnersUpCount ?? 2;
  }

  /**
   * Select the best node for a request. Throws `NoRouteError` when no
   * node in the pool satisfies the request predicates.
   */
  select(req: RouteRequest): RouteDecision {
    const now = Date.now();
    let candidates = this.pool.candidatesForModel(req.model, now);
    if (req.region) {
      candidates = candidates.filter((n) => n.region === req.region);
    }
    if (typeof req.maxPricePer1kMicros === "number") {
      candidates = candidates.filter(
        (n) => n.pricePer1kOutputMicros <= (req.maxPricePer1kMicros as number),
      );
    }
    if (typeof req.minReputation === "number") {
      candidates = candidates.filter(
        (n) => n.reputation >= (req.minReputation as number),
      );
    }
    if (req.requireTee) {
      candidates = candidates.filter(
        (n) => n.attestation.type !== "software",
      );
    }

    if (candidates.length === 0) {
      throw new NoRouteError(req);
    }

    const ctx: ScoreContext = {
      maxPriceMicros: Math.max(
        ...candidates.map((n) => n.pricePer1kOutputMicros),
      ),
      maxLatencyMs: Math.max(...candidates.map((n) => n.latencyP50Ms)),
    };
    const weights = { ...this.weights, ...(req.weights ?? {}) } as ScoreWeights;

    const scored = candidates.map((node) => ({
      node,
      score: scoreNode(node, ctx, weights),
    }));

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Deterministic tie-break: higher uptime first, then lower price,
      // then lexicographic pubkey. Optionally salt by caller id for
      // fairness across identical callers.
      if (b.node.uptimeSeconds !== a.node.uptimeSeconds) {
        return b.node.uptimeSeconds - a.node.uptimeSeconds;
      }
      if (a.node.pricePer1kOutputMicros !== b.node.pricePer1kOutputMicros) {
        return a.node.pricePer1kOutputMicros - b.node.pricePer1kOutputMicros;
      }
      const salt = req.callerId ?? "";
      const aKey = salt + a.node.pubkey;
      const bKey = salt + b.node.pubkey;
      return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
    });

    const [winner, ...rest] = scored;
    const runnersUp = rest.slice(0, this.runnersUpCount);
    const decision: RouteDecision = {
      node: winner.node,
      score: winner.score,
      runnersUp,
      reason: describe(req, weights, winner.node),
    };
    this.logger.info(
      {
        model: req.model,
        node: winner.node.nodeId,
        score: winner.score,
        candidates: candidates.length,
      },
      "route decided",
    );
    return decision;
  }
}

function describe(
  req: RouteRequest,
  weights: ScoreWeights,
  node: NodeRecord,
): string {
  const parts: string[] = [];
  if (req.requireTee) parts.push(`tee=${node.attestation.type}`);
  parts.push(`region=${node.region}`);
  parts.push(`price=${node.pricePer1kOutputMicros}`);
  parts.push(`latency=${node.latencyP50Ms}ms`);
  parts.push(`reputation=${node.reputation.toFixed(3)}`);
  parts.push(
    `weights=p:${weights.price},l:${weights.latency},r:${weights.reputation},a:${weights.attestation}`,
  );
  return parts.join(" ");
}

export class NoRouteError extends Error {
  constructor(public readonly request: RouteRequest) {
    super(
      `no node in the pool satisfies the routing request for model="${request.model}"`,
    );
    this.name = "NoRouteError";
  }
}
