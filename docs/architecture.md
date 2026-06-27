# Wattz Architecture

Solana AI Inference Marketplace. OpenAI-compatible API + TEE verification + PDA
Model Registry + Streaming Token-2022 micro payment + Anchor mainnet settlement +
self-operated bootstrap nodes.

## High-Level Topology

```
                            +--------------------------+
                            |    Web (apps/web)        |
                            |  Next.js 14 + Three.js   |
                            |  substation night scene  |
                            |  + Inference Playground  |
                            +-----+------------------+-+
                                  |                  |
                     same-origin  |                  | wallet adapter
                     /api/* proxy |                  | public RPC only
                                  v                  v
                       +--------------------+   +--------------+
                       | Inference Gateway  |   | Solana chain |
                       | (Rust axum)        |<--+ mainnet-beta |
                       |  /v1/chat          |   +--------------+
                       |  /v1/embeddings    |            ^
                       |  /v1/images        |            |
                       |  /v1/models        |            | settle_inference
                       +----+-----+---------+            | (Anchor CPI)
                            |     |                      |
             routing-engine |     | attestation verify   |
                            v     v                      |
                    +-----------------------+            |
                    |   Node Pool           |            |
                    |   +----+   +----+     |            |
                    |   | N1 |   | N2 | ... |------------+
                    |   +----+   +----+     |
                    |  bootstrap nodes +    |
                    |  operator nodes       |
                    +-----------------------+
                            ^
              heartbeat +   |
             attestation    |
                    +-------+---------+
                    | node-runtime    |
                    | (Rust GPU host) |
                    | Ollama / vLLM   |
                    +-----------------+
```

## Package Responsibilities

| Package | Role |
|---------|------|
| `packages/inference-gateway` | OpenAI-compatible API. Routes to the right node. Verifies TEE attestation. Emits inference receipts. |
| `packages/anchor-program` | Anchor 0.31 program on Solana mainnet. Nodes, models, receipts, disputes, staking, slashing. |
| `packages/model-registry` | Publishes model metadata + license enforcement + KYC gating helpers. |
| `packages/compute-verifier` | Intel SGX / AMD SEV-SNP / NVIDIA CC quote verification + Risc0/SP1 ZK proof verification. |
| `packages/routing-engine` | Node selection scoring: model support, region, price, latency, reputation. |
| `packages/streaming-payment` | Token-2022 transfer hook driving per-token micro payments alongside SSE streams. |
| `packages/node-runtime` | Rust GPU node host. Wraps Ollama / vLLM / TGI. Emits attestation quotes. |
| `packages/bootstrap-nodes` | Docker Compose + Runpod / Vast.ai / Lambda / local RTX deployment scripts for the project-owned nodes. |
| `packages/sdk-ts` | TypeScript SDK. Matches OpenAI SDK surface. |
| `packages/cli` | `wattz-cli` npm package. Node operator + model publisher CLI. |
| `packages/telegram-bot` | Notifier for node operators and builders. |
| `apps/web` | Landing + Playground. |
| `apps/operator` | Node operator dashboard. |

## Data Flow: A Chat Completion

1. Client (SDK, CLI, or web Playground) POSTs `/v1/chat/completions` to the
   inference gateway.
2. The gateway resolves the `model` against `packages/model-registry` (which
   maps to a `ModelAccount` PDA on Solana).
3. `packages/routing-engine` picks a live node from the pool. Bootstrap nodes
   are considered first when the pool would otherwise fail closed.
4. The gateway proxies to the node's local `node-runtime`. Streaming responses
   are forwarded as SSE chunks. Non-streaming responses are relayed as JSON.
5. Each response carries a TEE attestation quote in the `X-Wattz-Attestation`
   header. The gateway verifies it with `packages/compute-verifier` before
   returning the last chunk.
6. When the stream closes, the gateway calls
   `packages/anchor-program::submit_inference` to write an `InferenceReceipt`
   PDA with prompt/response/attestation hashes, token counts, and price.
7. `settle_inference` is called after the dispute window (default 30 s at
   launch, tuned upward for high-value inferences). 50 % of the collected fee
   flows to a $WATTZ buyback + burn CPI; the rest is split between the node
   operator, model publisher, and routing referrers.
8. Meanwhile, `packages/streaming-payment` walks the Token-2022 transfer hook
   for continuous micro payments as tokens are emitted, so payment matches
   the actual amount of work.

## Failure Modes

- Node returns bogus attestation → verify fails → gateway retries on a
  different node → the offending node's reputation drops. Repeated failures
  (or an outright dispute) trigger `slash_node`.
- Node goes silent mid-stream → gateway falls back to the bootstrap pool for
  the remaining tokens. The already-settled fraction is honored; the
  remainder is charged to whoever finished the work.
- Model license blocks the caller (e.g. Meta Community License for a caller
  claimed above the 700 M MAU threshold) → gateway returns a `403
  license_violation` and never bills.
- Gateway loses its Solana RPC → receipts pool locally and get flushed once
  RPC returns. Nothing is dropped.

## Security Boundaries

- Client-side code never touches a private RPC key.
  `NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com` is the only
  RPC the browser ever sees.
- Helius / QuickNode URLs live server-side only, behind the gateway and the
  Next.js Route Handlers.
- The gateway holds `ANCHOR_KEYPAIR` for settlement signing. This keypair
  never leaves the gateway VM.
- Node operators sign attestation quotes with their SGX enclave key (or
  equivalent). The compute-verifier crate rejects self-signed or expired
  attestations before the receipt is written.
