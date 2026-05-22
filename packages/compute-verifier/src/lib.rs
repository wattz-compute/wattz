//! Wattz compute verifier.
//!
//! Independent crate re-used by the inference gateway and the node runtime.
//! Verifies TEE attestation quotes (Intel SGX DCAP, AMD SEV-SNP, NVIDIA
//! Confidential Computing) and Risc0 / SP1 receipt commitments emitted by
//! nodes.

pub mod tee;
pub mod zk;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum VerifyError {
    #[error("malformed attestation payload: {0}")]
    Malformed(String),
    #[error("signature verification failed")]
    BadSignature,
    #[error("cert chain does not root to the expected authority")]
    BadChain,
    #[error("measurement mismatch: expected {expected}, got {actual}")]
    MeasurementMismatch { expected: String, actual: String },
    #[error("unsupported profile: {0}")]
    Unsupported(String),
}
