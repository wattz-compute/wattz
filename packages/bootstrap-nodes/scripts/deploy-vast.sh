#!/usr/bin/env bash
# Provision a Vast.ai GPU instance running the Wattz bootstrap image.
#
# Requires:
#   VAST_API_KEY                Vast.ai REST key.
#   INFERENCE_GATEWAY_URL       Wattz gateway base URL.
#   BOOTSTRAP_NODE_TOKEN        shared secret; must match the gateway.
#   VAST_GPU_QUERY              query string, e.g. 'gpu_name=RTX_4090' (default)
#   WATTZ_MODEL                 default llama3:8b-instruct-q4_K_M
#
# Flow:
#   1. Search offers matching the GPU query.
#   2. Pick the cheapest, above 1.5$/hr, RTX 4090+ with 24GB VRAM.
#   3. `PUT /asks/<offer_id>/` to create an instance.
set -Eeuo pipefail

: "${VAST_API_KEY:?VAST_API_KEY required}"
: "${INFERENCE_GATEWAY_URL:?INFERENCE_GATEWAY_URL required}"
BOOTSTRAP_NODE_TOKEN="${BOOTSTRAP_NODE_TOKEN:-}"
VAST_GPU_QUERY="${VAST_GPU_QUERY:-gpu_name=RTX_4090 rentable=true reliability>0.95}"
WATTZ_MODEL="${WATTZ_MODEL:-llama3:8b-instruct-q4_K_M}"
IMAGE="ghcr.io/wattz-labs/wattz-node:0.1.0"

echo "searching Vast.ai offers: ${VAST_GPU_QUERY}"

offer_id=$(curl --fail --silent --show-error \
  --header "Authorization: Bearer ${VAST_API_KEY}" \
  --get "https://console.vast.ai/api/v0/bundles/" \
  --data-urlencode "q=${VAST_GPU_QUERY}" \
  --data-urlencode "order=[[\"dph_total\",\"asc\"]]" \
  | jq -r '.offers[0].id')

if [ -z "${offer_id}" ] || [ "${offer_id}" = "null" ]; then
  echo "no matching Vast.ai offers" >&2
  exit 1
fi

echo "creating instance from offer ${offer_id}"

payload=$(cat <<JSON
{
  "client_id": "me",
  "image": "${IMAGE}",
  "env": {
    "INFERENCE_GATEWAY_URL": "${INFERENCE_GATEWAY_URL}",
    "BOOTSTRAP_NODE_TOKEN": "${BOOTSTRAP_NODE_TOKEN}",
    "WATTZ_MODEL": "${WATTZ_MODEL}",
    "WATTZ_NODE_ID": "wattz-vast-${offer_id}",
    "WATTZ_NODE_REGION": "us-central",
    "NODE_HTTP_LISTEN": "0.0.0.0:8081"
  },
  "disk": 40,
  "runtype": "ssh_direc",
  "onstart": "cd / && /usr/local/bin/entrypoint.sh",
  "extra_env": {"NVIDIA_VISIBLE_DEVICES": "all"}
}
JSON
)

curl --fail --silent --show-error \
  --header "Authorization: Bearer ${VAST_API_KEY}" \
  --header "Content-Type: application/json" \
  --request PUT \
  --data "${payload}" \
  "https://console.vast.ai/api/v0/asks/${offer_id}/" | jq '.'
