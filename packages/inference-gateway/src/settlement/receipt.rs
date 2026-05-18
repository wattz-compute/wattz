//! Anchor `submit_inference` instruction args.
//!
//! Layout (Borsh):
//! ```text
//! struct SubmitInference {
//!   request_id: [u8; 16],       // uuid v4
//!   model_id: String,           // "llama-3-8b"
//!   input_tokens: u32,
//!   output_tokens: u32,
//!   price_lamports: u64,
//!   node_pubkey: [u8; 32],
//!   attestation_hash: [u8; 32], // sha256(attestation envelope bytes)
//!   attestation_kind: u8,       // 0 sgx / 1 sev / 2 nvidia / 3 risc0 / 4 sp1
//!   started_at: i64,            // unix seconds
//!   completed_at: i64,
//!   region: String,
//! }
//! ```

use crate::attestation::{AttestationOutcome, QuoteType};
use borsh::{BorshDeserialize, BorshSerialize};
use chrono::{DateTime, Utc};
use serde::Serialize;
use sha2::{Digest, Sha256};

/// Domain object -- fields captured by the gateway during a request.
#[derive(Clone, Debug, Serialize)]
pub struct InferenceReceipt {
    pub request_id: uuid::Uuid,
    pub model_id: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub price_lamports: u64,
    pub node_pubkey: String,
    pub region: String,
    pub started_at: DateTime<Utc>,
    pub completed_at: DateTime<Utc>,
    pub attestation: Option<AttestationOutcome>,
}

impl InferenceReceipt {
    /// Convert to the on-chain instruction arg bytes (Borsh) for
    /// `submit_inference`.
    pub fn to_instruction_args(&self) -> ReceiptInstructionArgs {
        let node_pubkey = bs58::decode(&self.node_pubkey)
            .into_vec()
            .unwrap_or_default();
        let mut node_pubkey_arr = [0u8; 32];
        if node_pubkey.len() == 32 {
            node_pubkey_arr.copy_from_slice(&node_pubkey);
        }

        let (attestation_kind, attestation_hash) = match &self.attestation {
            Some(att) => {
                let mut hasher = Sha256::new();
                hasher.update(att.signer_pubkey_hex.as_bytes());
                hasher.update(att.measurement_hex.as_bytes());
                hasher.update(att.report_data_hex.as_bytes());
                let digest = hasher.finalize();
                let mut arr = [0u8; 32];
                arr.copy_from_slice(&digest);
                let kind = match att.quote_type {
                    QuoteType::Sgx => 0,
                    QuoteType::SevSnp => 1,
                    QuoteType::NvidiaCc => 2,
                    QuoteType::Risc0 => 3,
                    QuoteType::Sp1 => 4,
                };
                (kind, arr)
            }
            None => (255, [0u8; 32]),
        };

        ReceiptInstructionArgs {
            request_id: *self.request_id.as_bytes(),
            model_id: self.model_id.clone(),
            input_tokens: self.input_tokens,
            output_tokens: self.output_tokens,
            price_lamports: self.price_lamports,
            node_pubkey: node_pubkey_arr,
            attestation_hash,
            attestation_kind,
            started_at: self.started_at.timestamp(),
            completed_at: self.completed_at.timestamp(),
            region: self.region.clone(),
        }
    }
}

/// The Borsh-serialisable instruction args.
#[derive(Clone, Debug, BorshSerialize, BorshDeserialize)]
pub struct ReceiptInstructionArgs {
    pub request_id: [u8; 16],
    pub model_id: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub price_lamports: u64,
    pub node_pubkey: [u8; 32],
    pub attestation_hash: [u8; 32],
    pub attestation_kind: u8,
    pub started_at: i64,
    pub completed_at: i64,
    pub region: String,
}
