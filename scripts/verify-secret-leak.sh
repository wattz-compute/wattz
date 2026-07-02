#!/usr/bin/env bash
# CI gate: refuse to publish when a secret key leaks to the client bundle.
# - Helius / QuickNode / LaserStream keys must not appear in build artifacts.
# - No secret env var may be exposed via a NEXT_PUBLIC_ prefix.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAIL=0

# 1) Source-tree check: no risky NEXT_PUBLIC_* prefixes.
if grep -rn -E 'NEXT_PUBLIC_(HELIUS|QUICKNODE|GROQ|BOT_TOKEN|ANCHOR_KEYPAIR|GATEWAY_AUTH|HUGGINGFACE|RAILWAY|VERCEL)_' \
    apps/ packages/ 2>/dev/null | grep -v .example; then
  echo "FAIL: secret env exposed via NEXT_PUBLIC_ prefix"
  FAIL=1
else
  echo "PASS: no NEXT_PUBLIC_ secret prefix"
fi

# 2) Build-output check: no api-key literal for the paid RPCs.
BUILD_DIRS=$(find apps/*/.next packages/*/dist -type d 2>/dev/null || true)
if [ -n "$BUILD_DIRS" ]; then
  if echo "$BUILD_DIRS" | while read -r d; do
      [ -d "$d" ] || continue
      grep -rlE 'helius-rpc\.com/\?api-key=|laserstream[^"]*api-key=|quicknode' "$d" 2>/dev/null || true
    done | grep -q .; then
    echo "FAIL: secret RPC URL bundled into build artifact"
    FAIL=1
  else
    echo "PASS: build artifacts clean"
  fi
else
  echo "SKIP: no build artifacts yet (re-run after build)"
fi

if [ "$FAIL" -eq 1 ]; then
  echo
  echo "Secret leak check failed. Refusing to publish."
  exit 1
else
  echo
  echo "Secret leak check passed."
fi
