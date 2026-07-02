# @wattz/routing-engine

Node selection for the Wattz inference gateway. Given a model and an
optional set of constraints, it scores the online node pool on model
support, region, price, latency, reputation, and attestation profile, then
returns the best route or a typed `NoRouteError`.

The gateway holds a `NodePool` populated from node heartbeats and asks the
`RoutingEngine` for a decision on every request.

## Install

```bash
pnpm add @wattz/routing-engine
```

## Usage

```ts
import { NodePool, RoutingEngine, DEFAULT_WEIGHTS } from '@wattz/routing-engine';

const pool = new NodePool();
pool.upsert({
  pubkey: 'Node1111111111111111111111111111111111111111',
  region: 'us-east',
  models: ['llama-3.1-8b-instant'],
  pricePer1kTokens: 0,
  reputation: 10,
  latencyMs: 120,
  lastHeartbeatMs: Date.now(),
  attestation: { kind: 'relay', verified: false },
});

const engine = new RoutingEngine({ pool, weights: DEFAULT_WEIGHTS });

const decision = engine.route({
  model: 'llama-3.1-8b-instant',
  region: 'us-east',
  minReputation: 0,
});

// decision.node   -> chosen NodeRecord
// decision.score  -> weighted score in [0, 1]
```

## Scoring

`scoreNode` combines the weighted factors below; `attestationBonus` nudges
verified TEE nodes ahead of software-only or relay nodes at equal price and
latency.

| Factor | Default weight | Notes |
|--------|----------------|-------|
| price | 0.3 | Lower price scores higher. |
| latency | 0.3 | Lower observed latency scores higher. |
| reputation | 0.4 | On-chain reputation, clamped. |

Weights are overridable per engine instance. Nodes whose last heartbeat is
older than `HEARTBEAT_STALE_MS` are excluded from routing.

## Public surface

| Export | Purpose |
|--------|---------|
| `NodePool`, `NodeRecord`, `NodeAttestation` | In-memory pool of heartbeating nodes. |
| `RoutingEngine`, `RouteRequest`, `RouteDecision`, `NoRouteError` | Route resolution. |
| `scoreNode`, `attestationBonus`, `DEFAULT_WEIGHTS`, `ScoreWeights` | Scoring primitives. |
| `HEARTBEAT_STALE_MS` | Staleness cutoff for pool membership. |

## License

Apache-2.0.
