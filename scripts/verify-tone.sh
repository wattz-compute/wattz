#!/usr/bin/env bash
# CI gate: keep the tone in line -- no cyberpunk clichés, no emoji, no
# 19th-century vintage kitsch, and no mainnet claims. Wattz is
# industrial-precise + static, and settles on Solana devnet.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAIL=0

# Directories that hold vendored / generated output, never source copy.
EXCL="--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist \
--exclude-dir=target --exclude-dir=.turbo --exclude-dir=build \
--exclude-dir=.anchor"

# 1) Cyberpunk keyword list.
CYBERPUNK_KEYWORDS='cyberpunk|neo-tokyo|dystopia|hologram|holographic|shibuya|akihabara|kowloon|neon.rain|blade.runner|matrix.hackerman'
if grep -rniE $EXCL "$CYBERPUNK_KEYWORDS" apps/ packages/ docs/ 2>/dev/null; then
  echo "FAIL: cyberpunk vocabulary detected"
  FAIL=1
else
  echo "PASS: no cyberpunk vocabulary"
fi

# 2) Vintage / 19th-century keyword list.
VINTAGE_KEYWORDS='steampunk|edison|tesla.lab|victorian|belle.epoque|art.nouveau'
if grep -rniE $EXCL "$VINTAGE_KEYWORDS" apps/ packages/ 2>/dev/null; then
  echo "FAIL: 19th-century vintage vocabulary detected"
  FAIL=1
else
  echo "PASS: no vintage vocabulary"
fi

# 3) Emoji check (BMP + common SMP ranges). `-I` skips binary assets such as
# PNG banners whose raw bytes can alias emoji code-point ranges.
if grep -rlIP $EXCL '[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]|[\x{1F000}-\x{1F0FF}]|[\x{FE0F}]' \
    apps/ packages/ docs/ scripts/ 2>/dev/null | grep -v .lock | grep -v .example; then
  echo "FAIL: emoji detected"
  FAIL=1
else
  echo "PASS: no emoji"
fi

# 4) Mainnet claims. The marketplace program is deployed on Solana devnet;
# public copy must not claim mainnet. The public wallet-adapter RPC endpoint
# api.mainnet-beta.solana.com is the one legitimate exception.
if grep -rniE $EXCL 'solana mainnet|anchor mainnet|on mainnet' apps/ docs/ 2>/dev/null \
    | grep -viE 'api\.mainnet-beta\.solana\.com'; then
  echo "FAIL: mainnet claim detected (Wattz settles on devnet)"
  FAIL=1
else
  echo "PASS: no mainnet claims"
fi

if [ "$FAIL" -eq 1 ]; then
  echo
  echo "Tone check failed."
  exit 1
else
  echo
  echo "Tone check passed."
fi
