# Wattz Inference Spec

OpenAI wire compatibility. Existing OpenAI SDKs work by only changing
`baseURL` to `https://api.wattz.fi/v1`.

## Endpoints

### `POST /v1/chat/completions`

Same request body as OpenAI's Chat Completions API. Additional optional
fields Wattz accepts:

| Field | Type | Purpose |
|-------|------|---------|
| `wattz_region` | string | Prefer nodes in this region. Falls back to any region if none available. |
| `wattz_min_reputation` | integer | Skip nodes below this reputation score. |
| `wattz_settlement` | string | `optional` (default), `required`, `off` (off requires an authenticated project prepaid quota). |

Response body matches OpenAI's shape. Additional response headers:

| Header | Meaning |
|--------|---------|
| `X-Wattz-Node` | Public key of the node that produced the response. |
| `X-Wattz-Region` | Region that served the request. |
| `X-Wattz-Attestation` | Hex-encoded TEE quote (SGX / SEV-SNP / NVIDIA CC). |
| `X-Wattz-Attestation-Type` | `sgx` \| `sev-snp` \| `nvidia-cc`. |
| `X-Wattz-Receipt` | `InferenceReceipt` PDA address on Solana mainnet. |
| `X-Wattz-Price-Lamports` | Total charge in lamports of the settlement token. |

### `POST /v1/embeddings`

Same request/response as OpenAI. Model names include `text-embedding-3-small`
compatible drop-ins (routed to models with equivalent output dimensionality
according to their `ModelAccount.embedding_dim`).

### `POST /v1/images/generations`

Same request/response as OpenAI. Wattz routes to models tagged
`modality: image` (Stable Diffusion XL, Flux, etc.). The response's
`data[].b64_json` is populated when `response_format=b64_json`.

### `GET /v1/models`

Returns the registered set of `ModelAccount` PDAs, filtered to models
currently supported by at least one online node. Additional fields:

| Field | Meaning |
|-------|---------|
| `license` | `meta-community` \| `apache-2.0` \| `mit` \| `creativeml-rail-m` \| `custom`. |
| `kyc_gated` | Whether use requires a KYC-verified caller. |
| `price_per_1k_tokens` | Base price. Nodes may quote a lower price during off-peak windows. |
| `nodes_online` | Count of online nodes currently serving this model. |

### `GET /healthz` / `GET /readyz`

- `/healthz`: `{"status":"ok"}`, always 200 while the process is up.
- `/readyz`: 200 if the routing engine has at least one healthy node; 503
  otherwise. Bootstrap nodes are counted.

### `GET /metrics`

Prometheus text format. Includes `wattz_inference_requests_total`,
`wattz_inference_latency_seconds`, `wattz_settlement_lag_seconds`,
`wattz_node_online_gauge`, `wattz_attestation_verify_failures_total`.

## Streaming

Streaming responses use `text/event-stream`. Each SSE event has `data:`
lines carrying an OpenAI-compatible JSON chunk. The final chunk carries
`data: [DONE]`.

Per-token micro payments (`packages/streaming-payment`) run alongside the
SSE stream: as each chunk lands, the streaming payment coordinator submits a
partial `submit_inference` update. Cancelling the stream mid-flight settles
only the tokens already delivered.

## Errors

Error shape matches OpenAI's `{"error": {"message": "...", "type":
"...", "code": "..."}}`. Additional codes:

| Code | Meaning |
|------|---------|
| `no_node_available` | Routing engine could not find an eligible node. |
| `attestation_failed` | The chosen node returned an unverifiable quote. |
| `license_violation` | The requested model's license blocks this caller. |
| `settlement_backlog` | Anchor settlement is behind by more than `SETTLEMENT_MAX_LAG`. Only appears in `wattz_settlement=required` mode. |

## Backwards Compatibility Promise

Endpoint shape follows the OpenAI wire protocol at the point of writing.
Additive changes only: any new field appears in headers or optional request
body fields (never repurposes an existing OpenAI field). Removals require a
major version bump on the base path (`/v2/...`).
