#!/usr/bin/env bash
# Copy the freshly-built IDL + generated TypeScript types into the package's
# `idl/` and `types/` directories so downstream packages (sdk-ts, cli,
# apps/web) can consume them without depending on `target/`.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

IDL_SRC="$ROOT/target/idl/wattz_marketplace.json"
TYPES_SRC="$ROOT/target/types/wattz_marketplace.ts"

if [[ ! -f "$IDL_SRC" ]]; then
    echo "IDL not found at $IDL_SRC -- run 'anchor build' first" >&2
    exit 1
fi

mkdir -p "$ROOT/idl" "$ROOT/types"
cp "$IDL_SRC" "$ROOT/idl/wattz_marketplace.json"

if [[ -f "$TYPES_SRC" ]]; then
    cp "$TYPES_SRC" "$ROOT/types/wattz_marketplace.ts"
    echo "Copied IDL + types into $ROOT/idl and $ROOT/types"
else
    echo "Copied IDL into $ROOT/idl (types not present -- build with 'anchor build' first)"
fi
