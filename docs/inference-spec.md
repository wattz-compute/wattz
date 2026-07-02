# Wattz Inference Spec

OpenAI wire compatibility. Existing OpenAI SDKs work by only changing
`baseURL` to `https://api.wattz.fi/v1`.

Inference is relayed through Groq LPU capacity until the first bare-metal node
registers. The wire protocol does not change: the request and response shapes
below are identical on the relay path and the node path.

## Endpoints

### `POST /v1/chat/completions`

Same request body as OpenAI's Chat Completions API. Additional optional
fields Wattz accepts (all stripped before the request is forwarded upstream):

| Field | Type | Purpose |
|-------|------|---------|
| `wattz_region` | string | Prefer nodes in this region. Falls back to any region if none available. |
| `wattz_min_reputation` | number | Skip nodes below this reputation score. |
| `wattz_kyc_token` | string | KYC attestation for callers of license-gated models. May also be supplied via the `x-wattz-kyc` request header. |

The response body matches OpenAI's shape. Non-streaming responses gain a
`wattz` metadata block:

```json
{
  "id": "chatcmpl-...",
  "choices": [ ... ],
  "usage": { ... },
  "wattz": {
    "request_id": "410d8c76-d0b1-46c8-a230-27515ba280bb",
    "provider": "groq",
    "node": {
      "pubkey": "GroqUsEast11111111111111111111111111111111",
      "region": "us-east",
      "reputation": 0,
      "latency_ms": 118,
      "is_bootstrap_fallback": true
    },
    "attestation": { "verified": false, "kind": "relay" },
    "price_lamports": 0
  }
}
```

On the relay path `attestation.kind` is `relay` and `attestation.verified` is
`false`. Verified TEE outcomes appear here only once a bare-metal node serves
the request.

Every response (streaming and non-streaming) also carries these headers,
exposed via `access-control-expose-headers`:

| Header | Meaning |
|--------|---------|
| `x-wattz-node` | Public key (or relay identifier) of the compute that produced the response. |
| `x-wattz-region` | Region that served the request. |
| `x-wattz-attestation` | Attestation descriptor for the serving path. |
| `x-wattz-request-id` | Correlates the response with its receipt and metrics. |

### `POST /v1/embeddings`

Same request/response as OpenAI. Routed to models exposing an embedding
dimension in their registry entry.

### `POST /v1/images/generations`

Same request/response as OpenAI. Routed to models tagged with the image
modality. The response `data[].b64_json` is populated when
`response_format=b64_json`. Image models are listed in the catalogue with an
`awaiting node` status until a node advertising the modality registers.

### `GET /v1/models`

Returns the registered model set. The list is filtered to models currently
served by at least one online node, so it populates as nodes register (it can
be empty on the relay-only bootstrap path). Additional fields:

| Field | Meaning |
|-------|---------|
| `license` | Upstream license identifier. |
| `kyc_gated` | Whether use requires a KYC-verified caller. |
| `price_per_1k_tokens` | Base price. |
| `nodes_online` | Count of online nodes currently serving this model. |

### `GET /healthz` / `GET /readyz`

- `/healthz`: `{"status":"ok"}`, always 200 while the process is up.
- `/readyz`: 200 if the routing engine has at least one healthy path; 503
  otherwise.

### `GET /metrics`

Prometheus text format. Includes `wattz_inference_requests_total`,
`wattz_inference_latency_seconds`, `wattz_settlement_total`,
`wattz_attestation_total`, and an inflight-requests gauge.

## Streaming

Streaming responses use `text/event-stream`. Each SSE event carries an
OpenAI-compatible JSON chunk on a `data:` line; the final event is
`data: [DONE]`.

Token-2022 streaming settlement (`packages/streaming-payment`) activates with
the `$WATTZ` mint at launch. It walks the transfer hook alongside the SSE
stream so that a cancelled stream settles only the tokens already delivered.

## Errors

Error shape matches OpenAI's `{"error": {"message": "...", "type": "...",
"code": "..."}}`. Additional codes:

| Code | Meaning |
|------|---------|
| `no_node_available` | Routing engine could not find an eligible path. |
| `attestation_failed` | The chosen node returned an unverifiable envelope. |
| `license_violation` | The requested model's license blocks this caller. |

## Backwards Compatibility Promise

Endpoint shape follows the OpenAI wire protocol. Additive changes only: new
data appears in headers, the `wattz` metadata block, or optional request
fields, never by repurposing an existing OpenAI field. Removals require a
major version bump on the base path (`/v2/...`).
