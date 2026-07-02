# wattz-bootstrap-nodes

Configuration, deployment scripts and monitoring helpers for the
Wattz-operated bootstrap GPU nodes.

## Why bootstrap nodes?

A decentralized inference marketplace suffers a cold-start problem:
without any provably-honest GPU capacity the first client requests have
no route. Wattz operates a small fleet of bootstrap nodes to smooth the
transition until third-party operators come online. Every bootstrap
node runs the same `wattz-node-runtime` binary that third-party nodes
run, so there is no bespoke code path for our nodes.

## Layout

```
docker/
  Dockerfile.node        # container image bundling node-runtime + Ollama
  docker-compose.yml     # node-runtime + Ollama + Prometheus + Grafana
  entrypoint.sh          # boots Ollama, warms the model, launches node-runtime
scripts/
  deploy-runpod.sh       # Runpod REST API pod creation
  deploy-vast.sh         # Vast.ai instance creation
  deploy-lambda.sh       # Lambda Cloud instance creation
  deploy-local.sh        # local GPU (RTX 3060+, WSL, bare-metal)
  register-onchain.ts    # anchor register_node instruction
config/
  node.default.yaml      # node-runtime knobs
  models.registry.yaml   # models the bootstrap fleet serves
  prometheus.yml         # scrape config
attestation/
  generate-sgx-quote.sh
  generate-nvidia-cc.sh
  README.md              # attestation prerequisites
monitor/
  uptime-heartbeat.py    # secondary heartbeat -> gateway status page
```

## Deploying a bootstrap node

Pick a provider script and run it. Every script:

1. Provisions a GPU instance with the correct base image.
2. Copies `docker/` and `config/` to the instance.
3. Runs `docker compose up -d` on the instance.
4. Waits for the node to publish its first heartbeat.
5. Calls `scripts/register-onchain.ts` to publish the node's pubkey to
   the Wattz Anchor program (`register_node`).

Example (Runpod):

```
export RUNPOD_API_KEY=...
export WATTZ_GATEWAY_URL=https://api.wattz.fi
export WATTZ_MODEL=llama-3.1-8b-instant
./scripts/deploy-runpod.sh
```

## Attestation

* Intel SGX (Coffee Lake or newer): run `attestation/generate-sgx-quote.sh`
  inside a graphene / gramine enclave and pipe the resulting quote to
  the node runtime via `WATTZ_NODE_ATT_QUOTE`.
* NVIDIA Confidential Computing (H100, H200, B200): run
  `attestation/generate-nvidia-cc.sh` to invoke `nvattest --nonce ...`
  and produce the raw evidence bundle.

Software-only nodes are accepted but the routing engine downgrades
their reputation weight; every response envelope declares
`attestation_type = "software"` when this is the case.
