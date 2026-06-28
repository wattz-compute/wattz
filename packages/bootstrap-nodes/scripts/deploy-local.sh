#!/usr/bin/env bash
# Launch a Wattz bootstrap node on the local machine.
#
# Requires:
#   - Docker with GPU access (Docker Desktop w/ WSL GPU, or nvidia-container-toolkit).
#   - `docker compose` v2.
#
# Environment:
#   WATTZ_NODE_ID       (default: wattz-local-<hostname>)
#   WATTZ_NODE_REGION   (default: us-east)
#   WATTZ_MODEL         (default: llama3:8b-instruct-q4_K_M)
#   INFERENCE_GATEWAY_URL (default: http://localhost:8080)
set -Eeuo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
COMPOSE_DIR="${SCRIPT_DIR}/../docker"

export WATTZ_NODE_ID="${WATTZ_NODE_ID:-wattz-local-$(hostname)}"
export WATTZ_NODE_REGION="${WATTZ_NODE_REGION:-us-east}"
export WATTZ_MODEL="${WATTZ_MODEL:-llama3:8b-instruct-q4_K_M}"
export INFERENCE_GATEWAY_URL="${INFERENCE_GATEWAY_URL:-http://localhost:8080}"
export BOOTSTRAP_NODE_TOKEN="${BOOTSTRAP_NODE_TOKEN:-}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not installed" >&2
  exit 1
fi

if ! docker info --format '{{json .Runtimes}}' | grep -q nvidia; then
  cat >&2 <<'MSG'
warning: nvidia container runtime not detected. The node runtime will
boot but ollama will fall back to CPU. Install the nvidia-container-toolkit
for GPU acceleration.
MSG
fi

cd "${COMPOSE_DIR}"
docker compose up -d --build

echo "wattz bootstrap node is up. logs: docker compose logs -f wattz-node"
