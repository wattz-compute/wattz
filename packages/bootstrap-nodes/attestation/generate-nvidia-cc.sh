#!/usr/bin/env bash
# Generate an NVIDIA Confidential Computing attestation quote for a
# Hopper / Blackwell GPU.
#
# Requires:
#   - Hopper (H100 / H200) or Blackwell GPU in CC mode.
#   - NVIDIA r550+ driver.
#   - `nvattest` binary in $PATH (bundled with the NVIDIA CC SDK).
#
# Environment:
#   WATTZ_NODE_ATT_KEY               path to the 32-byte ed25519 seed.
#   WATTZ_NODE_NVIDIA_QUOTE_FILE     output binary quote (default:
#                                     /var/lib/wattz/nvidia_att_quote.bin)
#
# Wire format: matches the layout expected by
# `wattz-compute-verifier::verify_nvidia_cc_quote` (see the crate's docs
# for the byte layout).
set -Eeuo pipefail

: "${WATTZ_NODE_ATT_KEY:?WATTZ_NODE_ATT_KEY required}"
: "${WATTZ_NODE_NVIDIA_QUOTE_FILE:=/var/lib/wattz/nvidia_att_quote.bin}"

if ! command -v nvattest >/dev/null 2>&1; then
  echo "nvattest not found in PATH" >&2
  exit 1
fi

if [ ! -f "${WATTZ_NODE_ATT_KEY}" ]; then
  echo "attestation key ${WATTZ_NODE_ATT_KEY} not found" >&2
  exit 1
fi

nonce_file=$(mktemp)
trap 'rm -f "${nonce_file}"' EXIT

python3 - "${WATTZ_NODE_ATT_KEY}" "${nonce_file}" <<'PY'
import hashlib, sys
key = open(sys.argv[1], "rb").read()
digest = hashlib.sha256(key).digest()
open(sys.argv[2], "wb").write(digest)
PY

mkdir -p "$(dirname "${WATTZ_NODE_NVIDIA_QUOTE_FILE}")"

nvattest \
  --nonce-file "${nonce_file}" \
  --output "${WATTZ_NODE_NVIDIA_QUOTE_FILE}" \
  --format wattz-v1 \
  --gpu 0

echo "wrote NVIDIA CC quote to ${WATTZ_NODE_NVIDIA_QUOTE_FILE}"
