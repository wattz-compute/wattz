#!/usr/bin/env bash
# Boot script for a Wattz bootstrap node container.
#
# Order of operations:
#   1. Start ollama in the background (foreground blocks node-runtime).
#   2. Wait for its HTTP endpoint to accept connections.
#   3. Pull the model list declared in $WATTZ_MODEL (comma separated).
#   4. Exec the node runtime binary as PID 1's child so signals propagate.
set -Eeuo pipefail

log() { printf '[wattz-boot] %s\n' "$*"; }

: "${WATTZ_MODEL:=llama3:8b-instruct-q4_K_M}"
: "${OLLAMA_HOST:=0.0.0.0}"
: "${WATTZ_NODE_BACKEND_URL:=http://127.0.0.1:11434}"

log "starting ollama daemon"
ollama serve &
OLLAMA_PID=$!
trap 'log "shutting down"; kill "$OLLAMA_PID" || true' TERM INT

log "waiting for ollama at ${WATTZ_NODE_BACKEND_URL}"
for _ in $(seq 1 60); do
  if curl -fsS "${WATTZ_NODE_BACKEND_URL}/api/tags" >/dev/null 2>&1; then
    log "ollama up"
    break
  fi
  sleep 1
done

IFS=',' read -ra MODEL_LIST <<< "${WATTZ_MODEL}"
for m in "${MODEL_LIST[@]}"; do
  m_trimmed="$(echo -n "$m" | xargs)"
  [ -z "$m_trimmed" ] && continue
  log "pulling model $m_trimmed"
  ollama pull "$m_trimmed" || log "pull failed for $m_trimmed (retry via runtime)"
done

log "launching wattz-node-runtime"
exec /usr/local/bin/wattz-node-runtime
