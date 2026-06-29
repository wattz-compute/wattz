#!/usr/bin/env bash
# CI gate: refuse to publish placeholder / stub / auto-comment residue.
#
# 1) Stub / unimplemented!() / todo!() body markers.
# 2) TODO / FIXME comments.
# 3) `println!("would ...")` and friends (fake-live prints).
# 4) Auto-generated comments (rev-xxx, v2, patch-N).
#
# Must pass before every release.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAIL=0

check() {
  local label="$1"
  local pattern="$2"
  local scope="$3"
  local hits
  hits=$(grep -rn --include='*.rs' --include='*.ts' --include='*.tsx' \
      --include='*.js' --include='*.py' --include='*.md' \
      --exclude-dir='node_modules' --exclude-dir='.venv' --exclude-dir='venv' \
      --exclude-dir='target' --exclude-dir='dist' --exclude-dir='.next' \
      --exclude-dir='.turbo' --exclude-dir='build' --exclude-dir='.anchor' \
      --exclude-dir='test-ledger' --exclude-dir='coverage' \
      -E "$pattern" $scope 2>/dev/null || true)
  local count
  count=$(printf '%s' "$hits" | grep -c . || true)
  if [ "$count" -gt 0 ]; then
    echo "FAIL [$label] $count hits"
    printf '%s\n' "$hits" | head -20
    FAIL=1
  else
    echo "PASS [$label]"
  fi
}

SCOPE="packages/ apps/ docs/"

check "stub-unimpl" \
  '\b(Stub|unimplemented!\(\)|todo!\(\))\b' \
  "$SCOPE"
check "placeholder-comment-only" \
  '(//|#)\s*placeholder\b' \
  "$SCOPE"
check "todo-fixme" \
  '(^|[^A-Za-z0-9_])(TODO|FIXME)[:\s]' \
  "$SCOPE"
check "would-x" \
  '(println!|console\.log|print|log|msg!)\(["\047]would ' \
  "$SCOPE"
check "auto-gen-comments" \
  '//\s*(rev-[a-z0-9]{4,}|patch-[0-9]+|v[0-9]+\s*$)' \
  "$SCOPE"

if [ "$FAIL" -eq 1 ]; then
  echo
  echo "==========================================="
  echo "Placeholder / auto-comment residue found."
  echo "==========================================="
  exit 1
else
  echo
  echo "No placeholder residue."
fi
