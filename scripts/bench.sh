#!/usr/bin/env bash
# Wattz gateway latency benchmark.
#
# Measures time-to-first-byte (TTFB) for POST /v1/chat/completions against a
# running gateway and reports p50 / p95 over N requests. TTFB on a streaming
# request approximates time-to-first-token. Tokens/sec can be derived by
# counting SSE `data:` deltas over the wall-clock duration of a single
# streamed response (see the --tokens example below).
#
# Usage:
#   BASE=https://api.wattz.fi MODEL=llama-3.1-8b-instant N=20 bash scripts/bench.sh
#
# Optional auth:
#   WATTZ_API_KEY=sk-... bash scripts/bench.sh
#
# Tokens/sec for one streamed response:
#   curl -sN -X POST "$BASE/v1/chat/completions" \
#     -H 'Content-Type: application/json' \
#     -d '{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"Count to 50."}],"stream":true}' \
#     | grep -c '^data:'
set -euo pipefail

BASE="${BASE:-https://api.wattz.fi}"
MODEL="${MODEL:-llama-3.1-8b-instant}"
N="${N:-20}"
PROMPT="${PROMPT:-Say hello in one short sentence.}"

body() {
  printf '{"model":"%s","messages":[{"role":"user","content":"%s"}],"stream":true}' \
    "$MODEL" "$PROMPT"
}

echo "gateway : $BASE"
echo "model   : $MODEL"
echo "requests: $N"
echo

ttfbs=()
for i in $(seq 1 "$N"); do
  t=$(curl -s -o /dev/null -w '%{time_starttransfer}' \
    -X POST "$BASE/v1/chat/completions" \
    -H 'Content-Type: application/json' \
    ${WATTZ_API_KEY:+-H "Authorization: Bearer $WATTZ_API_KEY"} \
    -d "$(body)")
  ms=$(awk -v s="$t" 'BEGIN{printf "%.0f", s*1000}')
  ttfbs+=("$ms")
  printf 'req %2d  TTFB %6s ms\n' "$i" "$ms"
done

sorted=$(printf '%s\n' "${ttfbs[@]}" | sort -n)
count=$(printf '%s\n' "${ttfbs[@]}" | wc -l | tr -d ' ')

percentile() {
  local pct="$1" idx
  idx=$(awk -v c="$count" -v p="$pct" 'BEGIN{i=int((p/100)*c+0.5); if(i<1)i=1; if(i>c)i=c; print i}')
  printf '%s\n' "$sorted" | sed -n "${idx}p"
}

echo
echo "p50 TTFB: $(percentile 50) ms"
echo "p95 TTFB: $(percentile 95) ms"
