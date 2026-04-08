//! Model registry PDA. Tracks name / version / license / price / KYC gating.

use anchor_lang::prelude::*;

/// Software licence classification.
///
/// Kept as unit variants -- serialised as a single byte discriminator.
/// Additional licences can be introduced without breaking existing accounts by
/// remapping the `Custom` variant.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum License {
    /// Meta Llama Community Licence -- commercial ok < 700M MAU.
    MetaCommunity,
    /// Apache 2.0 -- fully open (Mistral, most OSS models).
    Apache2,
    /// MIT (Whisper, several small OSS).
    MIT,
    /// CreativeML Open RAIL-M (Stable Diffusion family).
    CreativeMLRailM,
    /// Anything not fitting the four buckets above; requires KYC gating.
    Custom,
}

impl License {
    /// Returns true when off-chain KYC is mandatory for consuming this model.
    pub fn requires_kyc(&self) -> bool {
        matches!(self, License::MetaCommunity | License::Custom)
    }

    /// Numeric tag for indexing / logging. Kept stable across upgrades.
    pub fn as_u8(&self) -> u8 {
        match self {
            License::MetaCommunity => 0,
            License::Apache2 => 1,
            License::MIT => 2,
            License::CreativeMLRailM => 3,
            License::Custom => 4,
        }
    }
}

/// Model registry PDA.
///
/// Seeds: `[b"model", publisher.key().as_ref(), name.as_bytes(), version.as_bytes()]`
///
/// One PDA per (publisher, name, version) triple. `ipfs_hash` is a CID pointer
/// to weights / manifest hosted off-chain (IPFS / Arweave / R2).
#[account]
#[derive(InitSpace)]
pub struct ModelAccount {
    /// Wallet that published (and can update pricing for) this model.
    pub publisher: Pubkey,
    /// Canonical model name, e.g. `llama-3-8b-instruct`.
    #[max_len(32)]
    pub name: String,
    /// Semver-ish version tag, e.g. `1.0.0`, `q4_k_m`.
    #[max_len(16)]
    pub version: String,
    /// Licence bucket.
    pub license: License,
    /// Content-addressed pointer to weights / manifest.
    #[max_len(64)]
    pub ipfs_hash: String,
    /// Price charged per 1k output tokens, denominated in $WATTZ base units.
    pub price_per_1k_tokens: u64,
    /// True when the model requires KYC-verified requesters.
    pub kyc_gated: bool,
    /// PDA bump.
    pub bump: u8,
}
