#!/usr/bin/env bash
# Provision a Lambda Cloud GPU instance running the Wattz bootstrap image.
#
# Requires:
#   LAMBDA_API_KEY               Lambda Cloud API key.
#   INFERENCE_GATEWAY_URL        Wattz gateway URL.
#   BOOTSTRAP_NODE_TOKEN         shared secret for the gateway.
#   LAMBDA_INSTANCE_TYPE         default gpu_1x_a10
#   LAMBDA_REGION                default us-west-1
#   LAMBDA_SSH_KEY_NAME          existing key registered on Lambda.
#   WATTZ_MODEL                  default llama3:8b-instruct-q4_K_M
#
# Lambda does not accept a container image directly; instead we boot an
# Ubuntu 22.04 instance and run a one-shot userdata script that installs
# Docker, pulls our image, and runs docker-compose.
set -Eeuo pipefail

: "${LAMBDA_API_KEY:?LAMBDA_API_KEY required}"
: "${INFERENCE_GATEWAY_URL:?INFERENCE_GATEWAY_URL required}"
: "${LAMBDA_SSH_KEY_NAME:?LAMBDA_SSH_KEY_NAME required}"
BOOTSTRAP_NODE_TOKEN="${BOOTSTRAP_NODE_TOKEN:-}"
LAMBDA_INSTANCE_TYPE="${LAMBDA_INSTANCE_TYPE:-gpu_1x_a10}"
LAMBDA_REGION="${LAMBDA_REGION:-us-west-1}"
WATTZ_MODEL="${WATTZ_MODEL:-llama3:8b-instruct-q4_K_M}"

USERDATA=$(cat <<UD
#!/usr/bin/env bash
set -Eeuo pipefail
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu || true
sudo docker pull ghcr.io/wattz-labs/wattz-node:0.1.0
sudo docker run -d --restart unless-stopped --gpus all \
  -e INFERENCE_GATEWAY_URL="${INFERENCE_GATEWAY_URL}" \
  -e BOOTSTRAP_NODE_TOKEN="${BOOTSTRAP_NODE_TOKEN}" \
  -e WATTZ_MODEL="${WATTZ_MODEL}" \
  -e WATTZ_NODE_ID="wattz-lambda-$(hostname)" \
  -e WATTZ_NODE_REGION="${LAMBDA_REGION}" \
  -e NODE_HTTP_LISTEN=0.0.0.0:8081 \
  -p 8081:8081 \
  --name wattz-node \
  ghcr.io/wattz-labs/wattz-node:0.1.0
UD
)

payload=$(jq -n \
  --arg region "${LAMBDA_REGION}" \
  --arg type "${LAMBDA_INSTANCE_TYPE}" \
  --arg keyname "${LAMBDA_SSH_KEY_NAME}" \
  --arg userdata "${USERDATA}" \
  '{
     region_name: $region,
     instance_type_name: $type,
     ssh_key_names: [$keyname],
     quantity: 1,
     user_data: $userdata
   }')

curl --fail --silent --show-error \
  --header "Authorization: Bearer ${LAMBDA_API_KEY}" \
  --header "Content-Type: application/json" \
  --data "${payload}" \
  "https://cloud.lambdalabs.com/api/v1/instance-operations/launch" | jq '.'
