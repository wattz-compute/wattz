//! # Wattz Marketplace
//!
//! Anchor 0.31 program powering the Solana AI Inference Marketplace. Handles:
//!
//! * `Config` singleton (admin / gateway / mint / treasury / dispute window).
//! * GPU node registration + staking + slashing.
//! * Model registry (name, version, licence, IPFS pointer, KYC gate).
//! * Inference receipts submitted by the trusted gateway.
//! * Settlement with an 80/10/5/5 revenue split (node immediate / node
//!   pending / publisher / project fee). The project fee is split 50/50: half
//!   is burned via a direct SPL Token burn CPI (2.5 % of every settled fee)
//!   and half goes to the treasury.
//! * Dispute open / resolve flow with reputation deltas.
//! * Uptime reward pool claim.
//!
//! Deployed on devnet at
//! `GUDVbE4Jgmtu8jgxUVtq2wUmjdLxJzPqT3zET2EdTLiU`; localnet tests live under
//! `tests/wattz-marketplace.ts`. Redeploying under a new keypair requires
//! `anchor keys sync` to re-align `declare_id!` and Anchor.toml.

#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;
use state::{License, Resolution};

declare_id!("GUDVbE4Jgmtu8jgxUVtq2wUmjdLxJzPqT3zET2EdTLiU");

#[program]
pub mod wattz_marketplace {
    use super::*;

    /// One-shot initializer: creates the `Config` PDA and the program vault ATA.
    pub fn initialize(
        ctx: Context<Initialize>,
        min_node_stake: u64,
        dispute_window_secs: i64,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, min_node_stake, dispute_window_secs)
    }

    /// Register a GPU node and lock the initial stake (>= `config.min_node_stake`).
    pub fn register_node(
        ctx: Context<RegisterNode>,
        gpu_model: String,
        region: String,
        endpoint: String,
        initial_stake: u64,
    ) -> Result<()> {
        instructions::register_node::handler(ctx, gpu_model, region, endpoint, initial_stake)
    }

    /// Publish a model + licence + price in the on-chain registry.
    pub fn register_model(
        ctx: Context<RegisterModel>,
        name: String,
        version: String,
        license: License,
        ipfs_hash: String,
        price_per_1k_tokens: u64,
        kyc_gated: bool,
    ) -> Result<()> {
        instructions::register_model::handler(
            ctx,
            name,
            version,
            license,
            ipfs_hash,
            price_per_1k_tokens,
            kyc_gated,
        )
    }

    /// Gateway records a completed inference receipt and funds the vault.
    pub fn submit_inference(
        ctx: Context<SubmitInference>,
        request_id: [u8; 32],
        prompt_hash: [u8; 32],
        response_hash: [u8; 32],
        tokens: u32,
        price: u64,
        tee_attestation_hash: [u8; 32],
    ) -> Result<()> {
        instructions::submit_inference::handler(
            ctx,
            request_id,
            prompt_hash,
            response_hash,
            tokens,
            price,
            tee_attestation_hash,
        )
    }

    /// After dispute window, distribute price and burn the project fee share.
    pub fn settle_inference(ctx: Context<SettleInference>) -> Result<()> {
        instructions::settle_inference::handler(ctx)
    }

    /// Open a dispute against a receipt during the dispute window.
    pub fn open_dispute(
        ctx: Context<OpenDispute>,
        reason_code: u8,
        evidence_hash: [u8; 32],
    ) -> Result<()> {
        instructions::open_dispute::handler(ctx, reason_code, evidence_hash)
    }

    /// Admin records dispute outcome, applying reputation + flag effects.
    pub fn resolve_dispute(ctx: Context<ResolveDispute>, resolution: Resolution) -> Result<()> {
        instructions::resolve_dispute::handler(ctx, resolution)
    }

    /// Admin slashes the stake of a node whose reputation dropped below the
    /// slashing threshold.
    pub fn slash_node(ctx: Context<SlashNode>, slash_amount: u64) -> Result<()> {
        instructions::slash_node::handler(ctx, slash_amount)
    }

    /// Top up an existing stake (or create it) and extend the lock.
    pub fn increase_stake(
        ctx: Context<IncreaseStake>,
        amount: u64,
        lock_duration_secs: i64,
    ) -> Result<()> {
        instructions::stake::handler(ctx, amount, lock_duration_secs)
    }

    /// Withdraw staked tokens once the lock has expired.
    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        instructions::unstake::handler(ctx, amount)
    }

    /// Claim the accumulated uptime reward pool for a node.
    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        instructions::claim_reward::handler(ctx)
    }
}
