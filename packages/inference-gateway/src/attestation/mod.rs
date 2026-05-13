//! TEE attestation and ZK proof verification.
//!
//! Every node response is expected to carry an `X-Wattz-Attestation`
//! header whose value is a JSON envelope of the following shape:
//!
//! ```json
//! {
//!   "quote_type": "sgx" | "sev-snp" | "nvidia-cc" | "risc0" | "sp1",
//!   "quote": "<base64 bytes>",
//!   "signature": "<hex>",
//!   "signer_pubkey": "<hex>",
//!   "mrenclave": "<hex>",
//!   "report_data": "<hex>"
//! }
//! ```
//!
//! The verifier parses the envelope and dispatches to the appropriate
//! backend (`tee::verify_sgx`, `tee::verify_sev_snp`,
//! `tee::verify_nvidia_cc`, `zk::verify_risc0`, `zk::verify_sp1`).
//!
//! Callers get back an [`AttestationOutcome`] describing what was
//! verified. The gateway attaches this to the settlement receipt so
//! disputes can be resolved on-chain.

pub mod tee;
pub mod zk;

use crate::error::ApiError;
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum QuoteType {
    Sgx,
    SevSnp,
    NvidiaCc,
    Risc0,
    Sp1,
}

#[derive(Clone, Debug, Deserialize)]
pub struct AttestationEnvelope {
    pub quote_type: QuoteType,
    /// Base64 encoded raw quote / receipt bytes.
    pub quote: String,
    /// Hex-encoded signature over the quote bytes.
    pub signature: String,
    /// Hex-encoded public key used to sign the quote.
    pub signer_pubkey: String,
    /// Optional pre-parsed MRENCLAVE / measurement (hex).
    #[serde(default)]
    pub mrenclave: Option<String>,
    /// Optional pre-parsed report_data (hex).
    #[serde(default)]
    pub report_data: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct AttestationOutcome {
    pub quote_type: QuoteType,
    pub signer_pubkey_hex: String,
    pub measurement_hex: String,
    pub report_data_hex: String,
    pub signature_ok: bool,
    pub structural_ok: bool,
    /// Free-form notes for the settlement receipt (which backend, byte
    /// counts, etc).
    pub notes: String,
}

impl AttestationOutcome {
    pub fn is_verified(&self) -> bool {
        self.signature_ok && self.structural_ok
    }
}

pub fn verify(envelope: &AttestationEnvelope) -> Result<AttestationOutcome, ApiError> {
    let quote = B64
        .decode(envelope.quote.as_bytes())
        .map_err(|e| ApiError::AttestationFailed(format!("bad base64 quote: {}", e)))?;
    let signature = hex::decode(&envelope.signature)
        .map_err(|e| ApiError::AttestationFailed(format!("bad hex signature: {}", e)))?;
    let signer = hex::decode(&envelope.signer_pubkey)
        .map_err(|e| ApiError::AttestationFailed(format!("bad hex signer key: {}", e)))?;

    match envelope.quote_type {
        QuoteType::Sgx => tee::verify_sgx(&quote, &signature, &signer),
        QuoteType::SevSnp => tee::verify_sev_snp(&quote, &signature, &signer),
        QuoteType::NvidiaCc => tee::verify_nvidia_cc(&quote, &signature, &signer),
        QuoteType::Risc0 => zk::verify_risc0(&quote, &signature, &signer),
        QuoteType::Sp1 => zk::verify_sp1(&quote, &signature, &signer),
    }
}
