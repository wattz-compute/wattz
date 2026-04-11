//! Stake PDA. One per staker (per wallet).

use anchor_lang::prelude::*;

/// Stake PDA.
///
/// Seeds: `[b"stake", staker.key().as_ref()]`
///
/// Tracks staked amount and lock expiry per unique staker. The tokens
/// themselves live in the program vault ATA; this account is metadata only.
#[account]
#[derive(InitSpace)]
pub struct StakeAccount {
    /// Wallet that owns this stake.
    pub staker: Pubkey,
    /// Currently staked amount in $WATTZ base units.
    pub amount: u64,
    /// Unix timestamp after which `unstake` is permitted.
    pub lock_until: i64,
    /// PDA bump.
    pub bump: u8,
}
