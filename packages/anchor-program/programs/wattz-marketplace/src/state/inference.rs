//! Inference receipt PDA. One per successful inference request.

use anchor_lang::prelude::*;

/// Inference receipt PDA.
///
/// Seeds: `[b"receipt", request_id.as_ref()]`
///
/// `request_id` is a 32-byte identifier produced by the gateway (typically the
/// blake3 hash of `{prompt, model, timestamp, requester}`). Storing prompt and
/// response as opaque hashes keeps the on-chain footprint small while allowing
/// any observer to reconstruct proofs off-chain against a signed transcript.
#[account]
#[derive(InitSpace)]
pub struct InferenceReceipt {
    /// Unique 32-byte request identifier.
    pub request_id: [u8; 32],
    /// PDA of the serving node.
    pub node: Pubkey,
    /// PDA of the model that produced the output.
    pub model: Pubkey,
    /// End-user requester wallet.
    pub requester: Pubkey,
    /// Blake3 / sha256 hash of the input prompt.
    pub prompt_hash: [u8; 32],
    /// Blake3 / sha256 hash of the streamed response.
    pub response_hash: [u8; 32],
    /// Number of output tokens billed.
    pub tokens: u32,
    /// Total price paid, denominated in $WATTZ base units.
    pub price: u64,
    /// Hash of the TEE attestation (Intel SGX / AMD SEV-SNP / NVIDIA CC).
    pub tee_attestation_hash: [u8; 32],
    /// Unix timestamp at which the receipt was created.
    pub timestamp: i64,
    /// Set true after `settle_inference` executes.
    pub settled: bool,
    /// Set true when a dispute is open against this receipt.
    pub disputed: bool,
    /// PDA bump.
    pub bump: u8,
}
