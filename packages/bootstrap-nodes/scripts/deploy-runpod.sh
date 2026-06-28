#!/usr/bin/env bash
# Provision a Runpod GPU pod running the Wattz bootstrap node image.
#
# Requires:
#   RUNPOD_API_KEY               Runpod REST API key.
#   INFERENCE_GATEWAY_URL        e.g. https://api.wattz.fi
#   BOOTSTRAP_NODE_TOKEN         shared secret; must match the gateway.
#   WATTZ_MODEL                  e.g. "llama3:8b-instruct-q4_K_M" (default)
#   RUNPOD_GPU_TYPE              e.g. "NVIDIA GeForce RTX 4090" (default)
#   RUNPOD_IMAGE                 override docker image (default wattz/node:0.1)
set -Eeuo pipefail

: "${RUNPOD_API_KEY:?RUNPOD_API_KEY required}"
: "${INFERENCE_GATEWAY_URL:?INFERENCE_GATEWAY_URL required}"
BOOTSTRAP_NODE_TOKEN="${BOOTSTRAP_NODE_TOKEN:-}"
WATTZ_MODEL="${WATTZ_MODEL:-llama3:8b-instruct-q4_K_M}"
RUNPOD_GPU_TYPE="${RUNPOD_GPU_TYPE:-NVIDIA GeForce RTX 4090}"
RUNPOD_IMAGE="${RUNPOD_IMAGE:-ghcr.io/wattz-labs/wattz-node:0.1.0}"

NAME="wattz-bootstrap-$(date +%s)"

echo "provisioning Runpod pod: ${NAME}"

payload=$(cat <<JSON
{
  "name": "${NAME}",
  "imageName": "${RUNPOD_IMAGE}",
  "gpuType": "${RUNPOD_GPU_TYPE}",
  "gpuCount": 1,
  "vcpuCount": 8,
  "memoryInGb": 32,
  "containerDiskInGb": 40,
  "volumeInGb": 40,
  "volumeMountPath": "/var/lib/wattz",
  "env": [
    {"key": "INFERENCE_GATEWAY_URL", "value": "${INFERENCE_GATEWAY_URL}"},
    {"key": "BOOTSTRAP_NODE_TOKEN", "value": "${BOOTSTRAP_NODE_TOKEN}"},
    {"key": "WATTZ_MODEL", "value": "${WATTZ_MODEL}"},
    {"key": "WATTZ_NODE_ID", "value": "${NAME}"},
    {"key": "WATTZ_NODE_REGION", "value": "us-east"},
    {"key": "NODE_HTTP_LISTEN", "value": "0.0.0.0:8081"}
  ],
  "ports": "8081/http",
  "supportPublicIp": true
}
JSON
)

curl --fail --silent --show-error \
     --header "Authorization: Bearer ${RUNPOD_API_KEY}" \
     --header "Content-Type: application/json" \
     --data "${payload}" \
     "https://rest.runpod.io/v1/pods" | jq '{id, name, machine, gpuTypeId, ports}'

echo "pod created. it will heartbeat to ${INFERENCE_GATEWAY_URL} on startup."
