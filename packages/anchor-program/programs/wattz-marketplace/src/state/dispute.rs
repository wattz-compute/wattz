//! Dispute PDA. Opened by requesters that suspect fraud / bad attestation.

use anchor_lang::prelude::*;

/// Dispute resolution outcome.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Resolution {
    /// No decision yet.
    Pending,
    /// Opener wins -- receipt is invalidated, node loses reputation.
    FavorOpener,
    /// Node wins -- dispute flag cleared, node gains reputation.
    FavorNode,
    /// Split -- partial penalty; receipt proceeds but node is docked.
    Split,
}

impl Resolution {
    /// Numeric tag for logging.
    pub fn as_u8(&self) -> u8 {
        match self {
            Resolution::Pending => 0,
            Resolution::FavorOpener => 1,
            Resolution::FavorNode => 2,
            Resolution::Split => 3,
        }
    }
}

/// Dispute PDA.
///
/// Seeds: `[b"dispute", receipt.key().as_ref()]`
///
/// One dispute per receipt. `evidence_hash` points to an off-chain packet
/// (mismatched TEE quote, tampered response transcript, ...).
#[account]
#[derive(InitSpace)]
pub struct DisputeAccount {
    /// The receipt being disputed.
    pub receipt: Pubkey,
    /// Wallet that opened the dispute.
    pub opener: Pubkey,
    /// Free-form reason bucket (0 = attestation-mismatch, 1 = quality, ...).
    pub reason_code: u8,
    /// Hash of the off-chain evidence bundle.
    pub evidence_hash: [u8; 32],
    /// Set true once the admin has recorded a resolution.
    pub resolved: bool,
    /// Final resolution.
    pub resolution: Resolution,
    /// PDA bump.
    pub bump: u8,
}
