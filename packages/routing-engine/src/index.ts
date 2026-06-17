/**
 * @wattz/routing-engine public surface.
 */

export type { ModelDescriptor } from "./models.js";

export {
  NodePool,
  HEARTBEAT_STALE_MS,
  type NodeRecord,
  type NodeAttestation,
} from "./nodes.js";

export {
  DEFAULT_WEIGHTS,
  attestationBonus,
  scoreNode,
  type ScoreContext,
  type ScoreWeights,
} from "./scoring.js";

export {
  RoutingEngine,
  NoRouteError,
  type RouteDecision,
  type RouteRequest,
  type RoutingEngineOptions,
} from "./engine.js";
