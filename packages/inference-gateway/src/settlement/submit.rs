//! Anchor settlement submitter.
//!
//! Wraps a [`solana_client::nonblocking::rpc_client::RpcClient`] plus
//! a signing [`Keypair`] and exposes [`SettlementClient::submit`] which
//! packs an [`InferenceReceipt`] into an Anchor instruction and sends it.

use crate::error::ApiError;
use crate::settlement::receipt::InferenceReceipt;
use borsh::BorshSerialize;
use serde::Serialize;
use sha2::{Digest, Sha256};
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::instruction::{AccountMeta, Instruction};
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{Keypair, Signature, Signer};
use solana_sdk::transaction::Transaction;
use std::path::Path;
use std::str::FromStr;
use std::sync::Arc;

/// System program id (base58 `11111111111111111111111111111111`, i.e.
/// the 32-byte all-zero pubkey). Duplicated here to sidestep the
/// `solana_sdk::system_program` deprecation warning in solana-sdk 2.x.
const SYSTEM_PROGRAM_ID: Pubkey = Pubkey::new_from_array([0u8; 32]);

/// Anchor instruction discriminator for `submit_inference`:
/// `sha256("global:submit_inference")[..8]`.
fn instruction_discriminator(name: &str) -> [u8; 8] {
    let preimage = format!("global:{}", name);
    let mut hasher = Sha256::new();
    hasher.update(preimage.as_bytes());
    let digest = hasher.finalize();
    let mut out = [0u8; 8];
    out.copy_from_slice(&digest[..8]);
    out
}

/// Anchor account PDA seeds we depend on.
fn derive_settlement_state(program_id: &Pubkey) -> Pubkey {
    let (pda, _) = Pubkey::find_program_address(&[b"wattz_settlement"], program_id);
    pda
}

fn derive_receipt_pda(program_id: &Pubkey, request_id: &[u8; 16]) -> Pubkey {
    let (pda, _) = Pubkey::find_program_address(&[b"wattz_receipt", request_id], program_id);
    pda
}

/// Human-readable summary of the settlement outcome.
#[derive(Clone, Debug, Serialize)]
pub struct SettlementSummary {
    pub signature: String,
    pub receipt_pda: String,
    pub program_id: String,
    pub slot: Option<u64>,
    pub simulated: bool,
}

pub struct SettlementClient {
    rpc: Arc<RpcClient>,
    program_id: Pubkey,
    signer: Option<Arc<Keypair>>,
    discriminator: [u8; 8],
}

impl SettlementClient {
    pub fn new(
        rpc_url: String,
        program_id: &str,
        keypair_path: Option<&str>,
    ) -> Result<Self, ApiError> {
        let rpc = Arc::new(RpcClient::new_with_commitment(
            rpc_url,
            CommitmentConfig::confirmed(),
        ));
        let program_id = Pubkey::from_str(program_id)
            .map_err(|e| ApiError::Internal(format!("bad program id: {}", e)))?;
        let signer = match keypair_path {
            Some(path) => {
                let kp = load_keypair(Path::new(path))?;
                Some(Arc::new(kp))
            }
            None => None,
        };
        Ok(Self {
            rpc,
            program_id,
            signer,
            discriminator: instruction_discriminator("submit_inference"),
        })
    }

    pub fn signer_pubkey(&self) -> Option<Pubkey> {
        self.signer.as_ref().map(|s| s.pubkey())
    }

    pub fn program_id(&self) -> Pubkey {
        self.program_id
    }

    /// Build an Anchor `submit_inference` instruction from the receipt.
    pub fn build_instruction(
        &self,
        receipt: &InferenceReceipt,
        payer: Pubkey,
    ) -> Result<Instruction, ApiError> {
        let args = receipt.to_instruction_args();
        let mut data = Vec::with_capacity(8 + 256);
        data.extend_from_slice(&self.discriminator);
        args.serialize(&mut data)
            .map_err(|e| ApiError::Internal(format!("borsh serialize: {}", e)))?;

        let settlement_state = derive_settlement_state(&self.program_id);
        let receipt_pda = derive_receipt_pda(&self.program_id, args.request_id.as_ref().try_into().unwrap());
        let node_pubkey = Pubkey::new_from_array(args.node_pubkey);

        let accounts = vec![
            AccountMeta::new(payer, true),
            AccountMeta::new(settlement_state, false),
            AccountMeta::new(receipt_pda, false),
            AccountMeta::new_readonly(node_pubkey, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
        ];

        Ok(Instruction {
            program_id: self.program_id,
            accounts,
            data,
        })
    }

    /// Submit the receipt. When no signer is configured (e.g. local
    /// dev without a keypair) the transaction is only simulated and
    /// returns a fake signature so callers can continue serving traffic.
    pub async fn submit(&self, receipt: &InferenceReceipt) -> Result<SettlementSummary, ApiError> {
        let signer = match &self.signer {
            Some(k) => k.clone(),
            None => {
                tracing::info!(
                    request_id = %receipt.request_id,
                    "no anchor keypair configured; skipping on-chain submission"
                );
                let program = self.program_id.to_string();
                let receipt_pda = derive_receipt_pda(
                    &self.program_id,
                    receipt.request_id.as_bytes(),
                )
                .to_string();
                return Ok(SettlementSummary {
                    signature: format!("simulated:{}", receipt.request_id),
                    receipt_pda,
                    program_id: program,
                    slot: None,
                    simulated: true,
                });
            }
        };

        let payer = signer.pubkey();
        let ix = self.build_instruction(receipt, payer)?;
        let blockhash = self
            .rpc
            .get_latest_blockhash()
            .await
            .map_err(|e| ApiError::SettlementFailed(format!("blockhash: {}", e)))?;
        let tx = Transaction::new_signed_with_payer(
            &[ix.clone()],
            Some(&payer),
            &[signer.as_ref()],
            blockhash,
        );
        let sig: Signature = self
            .rpc
            .send_and_confirm_transaction(&tx)
            .await
            .map_err(|e| ApiError::SettlementFailed(format!("send: {}", e)))?;

        let slot = self.rpc.get_slot().await.ok();
        let receipt_pda =
            derive_receipt_pda(&self.program_id, receipt.request_id.as_bytes()).to_string();
        Ok(SettlementSummary {
            signature: sig.to_string(),
            receipt_pda,
            program_id: self.program_id.to_string(),
            slot,
            simulated: false,
        })
    }
}

fn load_keypair(path: &Path) -> Result<Keypair, ApiError> {
    let raw = std::fs::read_to_string(path)
        .map_err(|e| ApiError::Internal(format!("read keypair {}: {}", path.display(), e)))?;
    let bytes: Vec<u8> = serde_json::from_str(&raw)
        .map_err(|e| ApiError::Internal(format!("keypair parse: {}", e)))?;
    if bytes.len() != 64 {
        return Err(ApiError::Internal(format!(
            "keypair must be 64 bytes, got {}",
            bytes.len()
        )));
    }
    Keypair::try_from(bytes.as_slice())
        .map_err(|e| ApiError::Internal(format!("keypair from bytes: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn discriminator_is_deterministic() {
        let d1 = instruction_discriminator("submit_inference");
        let d2 = instruction_discriminator("submit_inference");
        assert_eq!(d1, d2);
        let d3 = instruction_discriminator("other");
        assert_ne!(d1, d3);
    }
}
