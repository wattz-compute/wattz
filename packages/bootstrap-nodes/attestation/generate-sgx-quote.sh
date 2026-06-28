#!/usr/bin/env bash
# Generate an Intel SGX DCAP quote binding the node's ed25519 attestation
# public key to the current enclave.
#
# Requires:
#   - SGX-enabled CPU with FLC support (Coffee Lake or newer).
#   - `sgx-dcap-driver` module + PCS collateral (`sgx-provisioning-service`).
#   - Either `gramine-sgx` or the standalone `sgx_qgs_client`.
#
# Environment:
#   WATTZ_NODE_ATT_KEY        path to the 32-byte ed25519 seed.
#   WATTZ_NODE_ATT_QUOTE_FILE where to write the resulting binary quote.
set -Eeuo pipefail

: "${WATTZ_NODE_ATT_KEY:?WATTZ_NODE_ATT_KEY required}"
: "${WATTZ_NODE_ATT_QUOTE_FILE:=/var/lib/wattz/att_quote.bin}"

if [ ! -f "${WATTZ_NODE_ATT_KEY}" ]; then
  echo "attestation key ${WATTZ_NODE_ATT_KEY} not found" >&2
  exit 1
fi

# The DCAP driver exposes /dev/attestation/report_data as a write-only
# 64-byte sink. Write the SHA-256 of the pubkey into the first 32 bytes.
if [ ! -c /dev/attestation/report_data ]; then
  echo "gramine attestation interface not present -- rerun under gramine-sgx" >&2
  exit 1
fi

report_data=$(mktemp)
trap 'rm -f "${report_data}"' EXIT

python3 - "${WATTZ_NODE_ATT_KEY}" "${report_data}" <<'PY'
import hashlib, sys
key = open(sys.argv[1], "rb").read()
digest = hashlib.sha256(key).digest()
buf = digest + b"\x00" * (64 - len(digest))
open(sys.argv[2], "wb").write(buf)
PY

sudo dd if="${report_data}" of=/dev/attestation/report_data bs=64 count=1 status=none

# Reading /dev/attestation/quote returns the DCAP quote.
mkdir -p "$(dirname "${WATTZ_NODE_ATT_QUOTE_FILE}")"
sudo dd if=/dev/attestation/quote of="${WATTZ_NODE_ATT_QUOTE_FILE}" bs=8192 count=1 status=none

echo "wrote quote to ${WATTZ_NODE_ATT_QUOTE_FILE} ($(stat -c%s "${WATTZ_NODE_ATT_QUOTE_FILE}") bytes)"
