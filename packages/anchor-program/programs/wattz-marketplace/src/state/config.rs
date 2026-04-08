//! Program configuration PDA. Created once at `initialize` time.

use anchor_lang::prelude::*;

/// Singleton configuration PDA.
///
/// Seeds: `[b"config"]`
///
/// Stores the admin (governance) key, the trusted inference gateway key that
/// is allowed to submit receipts, the settlement mint, the treasury token
/// account, and economic parameters that can be tuned at deploy time.
#[account]
#[derive(InitSpace)]
pub struct Config {
    /// Governance authority. May resolve disputes and slash nodes.
    pub admin: Pubkey,
    /// Trusted inference gateway. Only this key may submit receipts.
    pub gateway: Pubkey,
    /// $WATTZ SPL mint used for settlement, staking and rewards.
    pub mint: Pubkey,
    /// SPL token account that receives the non-burned share of the project fee.
    pub treasury: Pubkey,
    /// Minimum stake required to register a GPU node.
    pub min_node_stake: u64,
    /// Grace period during which requesters may open a dispute.
    pub dispute_window_secs: i64,
    /// PDA bump for the vault authority (owner of the program vault ATA).
    pub vault_authority_bump: u8,
    /// PDA bump for this Config account.
    pub bump: u8,
}
