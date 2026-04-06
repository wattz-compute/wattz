//! Program error catalog. Anchor maps these to numeric codes starting at 6_000.

use anchor_lang::prelude::*;

#[error_code]
pub enum WattzError {
    #[msg("Provided stake is below the configured minimum")]
    InsufficientStake,

    #[msg("The referenced model account is not registered")]
    ModelNotRegistered,

    #[msg("TEE attestation hash is empty or malformed")]
    InvalidAttestation,

    #[msg("Node has been slashed and cannot serve inferences")]
    NodeSlashed,

    #[msg("A dispute is already open on this receipt")]
    DisputeAlreadyOpen,

    #[msg("Dispute window has elapsed; disputes are no longer accepted")]
    DisputeWindowElapsed,

    #[msg("Dispute window is still active; settlement is blocked")]
    DisputeWindowActive,

    #[msg("Receipt has already been settled")]
    ReceiptAlreadySettled,

    #[msg("Receipt is disputed; wait for resolution before settling")]
    ReceiptDisputed,

    #[msg("Model license requires additional off-chain verification")]
    LicenseViolation,

    #[msg("KYC gating enabled; requester attestation missing")]
    KycRequired,

    #[msg("String field exceeds its maximum length")]
    StringTooLong,

    #[msg("Stake is still within its lock period")]
    StakeLocked,

    #[msg("Requested amount exceeds staked balance")]
    InsufficientStakedAmount,

    #[msg("Node reputation is above the slashing threshold")]
    ReputationAboveSlashingThreshold,

    #[msg("Caller is not authorized for this instruction")]
    Unauthorized,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    #[msg("Dispute is not in a resolvable state")]
    DisputeNotResolved,

    #[msg("Invalid dispute resolution passed")]
    InvalidResolution,

    #[msg("Node has no pending rewards to claim")]
    NoPendingRewards,

    #[msg("Node account does not belong to the provided authority")]
    InvalidNodeAuthority,

    #[msg("Model support list is full")]
    ModelListFull,

    #[msg("Provided model account does not match receipt")]
    ModelMismatch,

    #[msg("Provided node account does not match receipt")]
    NodeMismatch,

    #[msg("Provided price cannot be zero")]
    InvalidPrice,
}
