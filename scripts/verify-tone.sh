#!/usr/bin/env bash
# CI gate: keep the tone in line -- no cyberpunk clichés, no emoji, no
# 19th-century vintage kitsch. Wattz is industrial-precise + static.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAIL=0

# 1) Cyberpunk keyword list.
CYBERPUNK_KEYWORDS='cyberpunk|neo-tokyo|dystopia|hologram|holographic|shibuya|akihabara|kowloon|neon.rain|blade.runner|matrix.hackerman'
if grep -rniE "$CYBERPUNK_KEYWORDS" apps/ packages/ docs/ 2>/dev/null; then
  echo "FAIL: cyberpunk vocabulary detected"
  FAIL=1
else
  echo "PASS: no cyberpunk vocabulary"
fi

# 2) Vintage / 19th-century keyword list.
VINTAGE_KEYWORDS='steampunk|edison|tesla.lab|victorian|belle.epoque|art.nouveau'
if grep -rniE "$VINTAGE_KEYWORDS" apps/ packages/ 2>/dev/null; then
  echo "FAIL: 19th-century vintage vocabulary detected"
  FAIL=1
else
  echo "PASS: no vintage vocabulary"
fi

# 3) Emoji check (BMP + common SMP ranges).
if grep -rlP '[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]|[\x{1F000}-\x{1F0FF}]|[\x{FE0F}]' \
    apps/ packages/ docs/ scripts/ 2>/dev/null | grep -v .lock | grep -v .example; then
  echo "FAIL: emoji detected"
  FAIL=1
else
  echo "PASS: no emoji"
fi

if [ "$FAIL" -eq 1 ]; then
  echo
  echo "Tone check failed."
  exit 1
else
  echo
  echo "Tone check passed."
fi
