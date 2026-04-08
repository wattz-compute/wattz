//! GPU node PDA. One per node operator authority.

use anchor_lang::prelude::*;

/// GPU node account.
///
/// Seeds: `[b"node", authority.key().as_ref()]`
///
/// One `NodeAccount` per unique operator authority. Reputation is a signed
/// running score updated on settle / dispute resolution / uptime heartbeats.
#[account]
#[derive(InitSpace)]
pub struct NodeAccount {
    /// Wallet that owns and operates the node.
    pub authority: Pubkey,
    /// Free-form GPU model tag, e.g. `RTX 4090`, `H100 80GB`.
    #[max_len(32)]
    pub gpu_model: String,
    /// ISO-3166 alpha-2 region code, e.g. `US`, `KR`, `EU-DE`.
    #[max_len(8)]
    pub region: String,
    /// HTTPS endpoint the routing engine hits for inference requests.
    #[max_len(128)]
    pub endpoint: String,
    /// Total tokens currently locked as stake by this node.
    pub stake_amount: u64,
    /// Running reputation score. Bounded on both sides.
    pub reputation: i32,
    /// Unix timestamp of the last successful settle or heartbeat.
    pub uptime_last_ping: i64,
    /// Models this node has advertised support for.
    #[max_len(16)]
    pub models_supported: Vec<Pubkey>,
    /// Accumulated uptime reward pool, claimable via `claim_reward`.
    pub pending_rewards: u64,
    /// Set true once the node has been slashed. Prevents further receipts.
    pub slashed: bool,
    /// PDA bump.
    pub bump: u8,
}
