# Wattz Security Notes

Report vulnerabilities privately to `security@wattz.fi`. Please do not open a
public issue for a suspected vulnerability. See the root `SECURITY.md` for the
short contact summary.

## Threat Model

Assets:

- User prompts and outputs. Confidentiality via TLS + optional payload
  encryption to the target enclave.
- Payment integrity. Any receipt must reflect what actually happened.
- Node stakes and rewards.
- Model license compliance data (KYC records).

Attackers:

- A node operator returning fabricated inference results to skim rewards
  without doing the work.
- An operator running an outdated model version while claiming a
  newer one.
- A model publisher publishing a model whose license they do not hold.
- A settlement relayer censoring receipts.
- Any party attempting to lift secrets out of `NEXT_PUBLIC_*` fields.

## Secrets Handling

- `HELIUS_RPC_URL`, `HELIUS_WS_URL`, `GROQ_API_KEY`, `ANCHOR_KEYPAIR`, and any
  `_API_KEY` / `_TOKEN` variables are server-side only.
- The Next.js apps only expose `NEXT_PUBLIC_SOLANA_RPC` (a public RPC
  endpoint) and functional flags. `scripts/verify-secret-leak.sh`, run by CI
  (`.github/workflows/ci.yml`), fails the pipeline if a `NEXT_PUBLIC_` secret
  prefix is introduced or if `helius-rpc.com/?api-key=` / `quicknode` appears
  in any `.next/` build artifact.
- All Solana wallet interactions in the browser go through the wallet adapter
  and the public RPC. Keyed RPC calls are proxied through the Next.js Route
  Handlers, never made directly from the client.

## CORS

The gateway uses an explicit CORS allowlist -- no wildcards, no
`allow_credentials=*`:

```
CORS_ORIGINS=https://wattz-web.vercel.app,https://wattz.fi,https://www.wattz.fi,http://localhost:3000
```

Route handlers under `apps/web/src/app/api/*` share the domain with the
browser and therefore never need CORS.

## Attestation Chain of Custody

See `docs/tee-attestation.md`. Summary:

1. Nonce is issued by the gateway, never by the node.
2. Attestation timestamps are bounded to `ATTESTATION_MAX_AGE_SECS`.
3. Trust roots are pinned by SHA-256 and rotated only by an Anchor
   governance vote.
4. Failed verifications degrade node reputation immediately and can lead
   to slashing.

## Settlement Integrity

Settlement CPIs run inside the Anchor program. The gateway's role is to
package receipts truthfully; the program enforces the math. Individual
receipts are idempotent by `(node, request_id)`. Duplicate submissions
are rejected on chain.

## KYC + License Gating

Some models require a KYC-verified caller (e.g. Meta Community License
above the 700 M MAU threshold, or custom commercial licenses). The
`ModelAccount.kyc_gated` boolean gates dispatch. KYC records are held
off chain by a compliance vendor; the gateway only sees a signed proof
of "this caller is cleared for license class N".

## Bug Bounty

At launch, a modest bug bounty pool is funded from the $WATTZ treasury.
Details will live at `https://wattz.fi/security/bounty`. In-scope
severity ratings mirror the Solana Foundation's rubric.
