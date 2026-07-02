# Benchmarks

Honest, reproducible latency numbers for the Wattz gateway. Everything below
is measured with `scripts/bench.sh`; nothing is hand-tuned or cherry-picked.
Numbers on the bootstrap relay path reflect Groq LPU capacity, not Wattz
bare-metal nodes.

## Methodology

Time-to-first-byte (TTFB) is measured with curl's `%{time_starttransfer}` on a
streaming chat completion, so TTFB approximates time-to-first-token. The
script issues N requests, sorts the samples, and reports p50 / p95.

```bash
BASE=https://api.wattz.fi MODEL=llama-3.1-8b-instant N=20 bash scripts/bench.sh
```

Tokens/sec for a single streamed response is the count of SSE `data:` deltas
over the wall-clock duration of that response:

```bash
curl -sN -X POST https://api.wattz.fi/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"Count to 50."}],"stream":true}' \
  | grep -c '^data:'
```

## Current numbers -- bootstrap relay path

Measured 2026-07-02 against `https://api.wattz.fi`, model
`llama-3.1-8b-instant`, N = 20, from a single client. This is the Groq LPU
relay path (`attestation.kind = "relay"`); it is what the live gateway serves
today.

| Metric | Value |
|--------|-------|
| Requests | 20 |
| TTFB p50 | 414 ms |
| TTFB p95 | 460 ms |
| TTFB min / max | 308 ms / 463 ms |

Command used:

```bash
BASE=https://api.wattz.fi MODEL=llama-3.1-8b-instant N=20 bash scripts/bench.sh
```

TTFB includes TLS handshake and full network round-trips from the measurement
host, so numbers from a colocated client will be lower. Re-run the command to
reproduce; results move with network conditions and upstream load.

## Target numbers -- bare-metal node path (projected, unverified)

These are design targets for the direct GPU-node path once external nodes
register. They are projected, not measured, and are listed here only so the
relay numbers above have context. Do not cite them as current performance.

| Metric | Target (projected, unverified) |
|--------|--------------------------------|
| TTFB p50 (colocated region) | < 250 ms |
| TTFB p95 (colocated region) | < 500 ms |
| Sustained tokens/sec (8B class, single H100) | 80 - 140 |

When bare-metal nodes are live, this section will be replaced with measured
numbers produced by the same `scripts/bench.sh` command and dated accordingly.
