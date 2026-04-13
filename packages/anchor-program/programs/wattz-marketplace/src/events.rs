//! On-chain program events. Emitted through Anchor's `emit!` and picked up by
//! Solana log subscribers (Helius Laserstream, RPC `logsSubscribe`, ...).

use anchor_lang::prelude::*;

#[event]
pub struct ProgramInitialized {
    pub config: Pubkey,
    pub admin: Pubkey,
    pub gateway: Pubkey,
    pub mint: Pubkey,
    pub treasury: Pubkey,
    pub min_node_stake: u64,
    pub dispute_window_secs: i64,
    pub timestamp: i64,
}

#[event]
pub struct NodeRegistered {
    pub node: Pubkey,
    pub authority: Pubkey,
    pub gpu_model: String,
    pub region: String,
    pub endpoint: String,
    pub initial_stake: u64,
    pub timestamp: i64,
}

#[event]
pub struct ModelPublished {
    pub model: Pubkey,
    pub publisher: Pubkey,
    pub name: String,
    pub version: String,
    pub license: u8,
    pub price_per_1k_tokens: u64,
    pub kyc_gated: bool,
    pub timestamp: i64,
}

#[event]
pub struct InferenceSubmitted {
    pub receipt: Pubkey,
    pub node: Pubkey,
    pub model: Pubkey,
    pub requester: Pubkey,
    pub tokens: u32,
    pub price: u64,
    pub tee_attestation_hash: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct InferenceSettled {
    pub receipt: Pubkey,
    pub node: Pubkey,
    pub publisher: Pubkey,
    pub node_immediate: u64,
    pub node_pending: u64,
    pub publisher_reward: u64,
    pub treasury_amount: u64,
    pub burned: u64,
    pub timestamp: i64,
}

#[event]
pub struct DisputeOpened {
    pub dispute: Pubkey,
    pub receipt: Pubkey,
    pub opener: Pubkey,
    pub reason_code: u8,
    pub evidence_hash: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct DisputeResolved {
    pub dispute: Pubkey,
    pub receipt: Pubkey,
    pub resolution: u8,
    pub reputation_delta: i32,
    pub timestamp: i64,
}

#[event]
pub struct NodeSlashed {
    pub node: Pubkey,
    pub authority: Pubkey,
    pub slash_amount: u64,
    pub remaining_stake: u64,
    pub reputation: i32,
    pub timestamp: i64,
}

#[event]
pub struct StakeIncreased {
    pub stake: Pubkey,
    pub staker: Pubkey,
    pub amount: u64,
    pub total: u64,
    pub lock_until: i64,
    pub timestamp: i64,
}

#[event]
pub struct StakeReleased {
    pub stake: Pubkey,
    pub staker: Pubkey,
    pub amount: u64,
    pub remaining: u64,
    pub timestamp: i64,
}

#[event]
pub struct RewardClaimed {
    pub node: Pubkey,
    pub authority: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}
