/**
 * Node registry consumed by the routing engine.
 *
 * Nodes are keyed by their solana pubkey (base58). The pool is refreshed
 * from the inference gateway's heartbeat channel; every heartbeat
 * updates the node's `updatedAt` and the `alive` predicate uses
 * `HEARTBEAT_STALE_MS` to decide whether to consider the node routable.
 */

export const HEARTBEAT_STALE_MS = 90_000;

export interface NodeAttestation {
  /** `"software"`, `"sgx"`, `"sev-snp"`, `"nvidia-cc"`. */
  type: string;
  /** ed25519 public key hex the node uses to sign response envelopes. */
  publicKeyHex: string;
}

export interface NodeRecord {
  /** Solana pubkey (base58). */
  pubkey: string;
  /** Human-readable node id from the heartbeat. */
  nodeId: string;
  /** e.g. `us-east`, `eu-central`, `ap-south`. */
  region: string;
  /** Backend name (`ollama` / `vllm` / `tgi`). */
  backend: string;
  /** URL the gateway forwards inference requests to. */
  endpoint: string;
  /** Model ids the node currently serves. */
  models: string[];
  /** Available VRAM in mebibytes at last heartbeat. */
  freeVramMib: number;
  /** Attestation properties. */
  attestation: NodeAttestation;
  /** Reputation score in `[0, 1]`, updated by the gateway based on
   *  slashing and dispute history. */
  reputation: number;
  /** Rolling p50 latency in milliseconds. */
  latencyP50Ms: number;
  /** Price paid per 1k output tokens in micro-payment units. */
  pricePer1kOutputMicros: number;
  /** Wall-clock at which the heartbeat was received. */
  updatedAt: number;
  /** Cumulative uptime seconds reported by the node. */
  uptimeSeconds: number;
}

export class NodePool {
  private readonly nodes = new Map<string, NodeRecord>();

  upsert(node: NodeRecord): void {
    this.nodes.set(node.pubkey, node);
  }

  remove(pubkey: string): void {
    this.nodes.delete(pubkey);
  }

  get(pubkey: string): NodeRecord | undefined {
    return this.nodes.get(pubkey);
  }

  size(): number {
    return this.nodes.size;
  }

  all(): NodeRecord[] {
    return Array.from(this.nodes.values());
  }

  alive(now: number = Date.now()): NodeRecord[] {
    return this.all().filter((n) => now - n.updatedAt <= HEARTBEAT_STALE_MS);
  }

  /** Nodes that serve the given model right now. */
  candidatesForModel(modelId: string, now: number = Date.now()): NodeRecord[] {
    return this.alive(now).filter((n) => n.models.includes(modelId));
  }
}
