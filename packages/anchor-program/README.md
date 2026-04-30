# @wattz/anchor-program

Anchor 0.31 program powering the Solana AI Inference Marketplace.

- Program id: `GUDVbE4Jgmtu8jgxUVtq2wUmjdLxJzPqT3zET2EdTLiU` (regenerate with `anchor keys sync` when deploying under a new keypair)
- Settlement token: `$WATTZ` (SPL Token, 9 decimals)
- Target cluster: `mainnet-beta`
- Tooling: Solana platform-tools >= v1.48 (rustc 1.84+), Anchor CLI 0.31.1, Node 20+

## Layout

```
packages/anchor-program/
  Anchor.toml
  Cargo.toml
  package.json
  tsconfig.json
  programs/wattz-marketplace/
    Cargo.toml
    Xargo.toml
    src/
      lib.rs                    -- #[program] entrypoint
      constants.rs              -- economic + PDA-seed constants
      errors.rs                 -- #[error_code] enum
      events.rs                 -- #[event] emitters
      state/
        config.rs               -- Config singleton PDA
        node.rs                 -- NodeAccount PDA
        model.rs                -- ModelAccount + License enum
        inference.rs            -- InferenceReceipt PDA
        dispute.rs              -- DisputeAccount + Resolution enum
        stake.rs                -- StakeAccount PDA
      instructions/
        initialize.rs
        register_node.rs
        register_model.rs
        submit_inference.rs
        settle_inference.rs
        open_dispute.rs
        resolve_dispute.rs
        slash_node.rs
        stake.rs                -- increase_stake
        unstake.rs
        claim_reward.rs
  tests/wattz-marketplace.ts    -- mocha end-to-end
  migrations/deploy.ts
  scripts/copy-idl.sh
  idl/                          -- IDL destination for downstream packages
```

## Instructions

| # | Instruction | Signer(s) | Notes |
|---|---|---|---|
| 1 | `initialize` | admin | Creates `Config` PDA + vault ATA. `min_node_stake` and `dispute_window_secs` are configurable. |
| 2 | `register_node` | node authority | Locks `initial_stake` (>= `config.min_node_stake`) into the vault, seeds `NodeAccount` and `StakeAccount`. |
| 3 | `register_model` | model publisher | Registers name/version/licence/IPFS/price. Meta Community + Custom licences auto-enable KYC gating. |
| 4 | `submit_inference` | gateway (== `config.gateway`) | Records receipt PDA + funds vault with `price` from the gateway's token account. |
| 5 | `settle_inference` | any | After dispute window, distributes 80/10/5 to node (immediate/pending/publisher), 2.5% treasury, 2.5% burn via SPL Token burn CPI. |
| 6 | `open_dispute` | any | Opens dispute against a non-settled receipt during the window. |
| 7 | `resolve_dispute` | admin | Records outcome (FavorOpener / FavorNode / Split) and applies reputation delta. |
| 8 | `slash_node` | admin | Burns a portion of the stake once reputation <= slashing threshold. |
| 9 | `increase_stake` | staker | Deposits additional stake + extends lock. |
| 10 | `unstake` | staker | Withdraws stake after lock expiry. |
| 11 | `claim_reward` | node authority | Withdraws accumulated `pending_rewards` (uptime pool). |

## Revenue split (basis points, sum = 10_000)

| Recipient | BPS | Notes |
|---|---|---|
| Node (immediate) | 8000 | CPI transfer to node token account on settle. |
| Node (pending pool) | 1000 | Credited to `NodeAccount.pending_rewards`; withdrawn via `claim_reward`. |
| Model publisher | 500 | CPI transfer to publisher token account on settle. |
| Project fee | 500 | 50% burned via `spl_token::burn`, 50% routed to treasury. |

## Build & test

```bash
# One-shot build (also emits IDL + TS types)
anchor build

# Sync program keypair -> declare_id!/Anchor.toml
anchor keys sync

# Copy IDL/types to package-local dirs for downstream SDKs
bash scripts/copy-idl.sh

# End-to-end mocha (spins up an ephemeral validator)
anchor test
```

Note: Solana platform-tools older than v1.48 ship rustc 1.75 which cannot compile
some transitive dependencies (edition2024). Install a compatible version with
`agave-install init 2.3.0` (platform-tools v1.48, rustc 1.84) or newer.

## Deploy to mainnet

```bash
# 1. Fund ~/.config/solana/id.json with SOL for rent + fees.
solana balance

# 2. Build + deploy.
anchor build
anchor deploy --provider.cluster mainnet

# 3. Publish IDL on-chain (optional but recommended).
anchor idl init \
  --filepath target/idl/wattz_marketplace.json \
  --provider.cluster mainnet \
  $(solana address -k target/deploy/wattz_marketplace-keypair.json)

# 4. Fold the program id into apps/web env:
#    NEXT_PUBLIC_2_PROGRAM_ID=<program id>
```

## Related

- Gateway (Rust axum): `packages/inference-gateway/`
- Node runtime (Rust): `packages/node-runtime/`
- SDK (TypeScript): `packages/sdk-ts/`
- Streaming payment (Token-2022): `packages/streaming-payment/`
- Web (Next.js): `apps/web/`
