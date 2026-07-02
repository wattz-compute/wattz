# wattz-node-runtime

Rust GPU-node host for the Wattz inference marketplace. It wraps a local
inference backend (Ollama, vLLM, or TGI), exposes an OpenAI-compatible HTTP
surface, signs each response with a per-node key, heartbeats to the gateway,
and serves Prometheus metrics. Bootstrap nodes and third-party nodes run the
same binary.

## Surface

```
GET  /healthz               -- liveness
GET  /readyz                -- readiness (backend reachable)
GET  /metrics               -- Prometheus exposition
GET  /v1/models             -- models this node serves
POST /v1/chat/completions   -- streaming or one-shot chat
POST /v1/embeddings         -- embeddings
```

## Run

```bash
# Defaults boot against a local Ollama daemon on :11434 and listen on :8081.
cargo run --package wattz-node-runtime
```

## Backends

`WATTZ_NODE_BACKEND` selects the local engine; each has a default URL:

| Backend | Default URL |
|---------|-------------|
| `ollama` | `http://localhost:11434` |
| `vllm` | `http://localhost:8000` |
| `tgi` | `http://localhost:3000` |

## Attestation

Each response is signed with an ed25519 key (`WATTZ_NODE_ATT_KEY`). When the
host has TEE hardware, the payload is wrapped in a real quote using the
`wattz-compute-verifier` envelope format (`WATTZ_NODE_TEE` selects the type;
`software` is the default for non-TEE hosts). The gateway verifies the
signature against the key pinned for this node at registration.

## Configuration

Every knob has a default, so a fresh checkout boots with `cargo run`.

| Variable | Default | Purpose |
|----------|---------|---------|
| `WATTZ_NODE_ID` | random `node-xxxxxxxx` | Node identifier. |
| `WATTZ_NODE_REGION` | `us-east` | Region label used by routing. |
| `INFERENCE_GATEWAY_URL` | `http://localhost:8080` | Gateway to heartbeat to. |
| `NODE_HTTP_LISTEN` | `0.0.0.0:8081` | HTTP listen address. |
| `WATTZ_NODE_BACKEND` | `ollama` | `ollama` \| `vllm` \| `tgi`. |
| `WATTZ_NODE_BACKEND_URL` | per-backend | Override the backend URL. |
| `WATTZ_NODE_ATT_KEY` | none | Path to the ed25519 attestation key. |
| `WATTZ_NODE_TEE` | `software` | Attestation type. |
| `WATTZ_HEARTBEAT_INTERVAL_SECS` | `30` | Heartbeat period. |
| `WATTZ_MODELS_FILE` | none | YAML catalogue of models to serve. |
| `WATTZ_PAYOUT_ADDRESS` | none | Solana payout address. |
| `BOOTSTRAP_NODE_TOKEN` | none | Bearer token expected by the gateway. |

If `WATTZ_MODELS_FILE` is unset, the node serves a built-in default catalogue
(`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`, `gpt-oss-20b`). See
`packages/bootstrap-nodes/config/models.registry.yaml` for the file format.

## License

Apache-2.0.
