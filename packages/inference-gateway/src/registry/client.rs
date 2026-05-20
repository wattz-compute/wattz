//! Read-only client for the Model Registry PDA.
//!
//! Uses `solana-client`'s nonblocking JSON-RPC to fetch the account,
//! strips the 8-byte Anchor discriminator, and decodes the remainder
//! with Borsh into [`ModelRegistryAccount`].

use crate::error::ApiError;
use borsh::{BorshDeserialize, BorshSerialize};
use serde::Serialize;
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;
use std::sync::Arc;

/// Anchor `#[account]` layout for one model entry.
#[derive(Clone, Debug, BorshSerialize, BorshDeserialize, Serialize)]
pub struct ModelEntry {
    pub model_id: String,
    pub display_name: String,
    pub hf_repo: String,
    /// Human-readable license label: `Apache-2.0`, `MIT`,
    /// `Meta-Llama-3-Community`, etc.
    pub license: String,
    /// SHA-256 of the tokenizer + config.json, used to detect drift.
    pub config_hash: [u8; 32],
    pub max_context: u32,
    /// Whether the model requires KYC (commercial licenses).
    pub kyc_required: bool,
    pub publisher: [u8; 32],
    /// Node public keys currently serving this model.
    pub serving_nodes: Vec<[u8; 32]>,
}

impl ModelEntry {
    pub fn publisher_str(&self) -> String {
        bs58::encode(self.publisher).into_string()
    }

    pub fn serving_nodes_str(&self) -> Vec<String> {
        self.serving_nodes
            .iter()
            .map(|k| bs58::encode(k).into_string())
            .collect()
    }
}

/// Root account of the Model Registry.
#[derive(Clone, Debug, BorshSerialize, BorshDeserialize, Serialize)]
pub struct ModelRegistryAccount {
    pub authority: [u8; 32],
    pub bump: u8,
    pub models: Vec<ModelEntry>,
    /// Slot at which this snapshot was written, so the gateway can
    /// detect stale caches.
    pub last_updated_slot: u64,
}

pub struct RegistryClient {
    rpc: Arc<RpcClient>,
    registry_pda: Pubkey,
}

impl RegistryClient {
    pub fn new(rpc_url: String, registry_pda: &str) -> Result<Self, ApiError> {
        let rpc = Arc::new(RpcClient::new_with_commitment(
            rpc_url,
            CommitmentConfig::confirmed(),
        ));
        let registry_pda = Pubkey::from_str(registry_pda)
            .map_err(|e| ApiError::Internal(format!("bad registry pda: {}", e)))?;
        Ok(Self { rpc, registry_pda })
    }

    /// Fetch the on-chain registry account. Returns `Ok(None)` if the
    /// PDA does not exist yet (bootstrap phase).
    pub async fn fetch(&self) -> Result<Option<ModelRegistryAccount>, ApiError> {
        let acc = match self.rpc.get_account(&self.registry_pda).await {
            Ok(a) => a,
            Err(e) => {
                // solana-client returns `AccountNotFound` variant on
                // missing accounts. We treat it as a soft error.
                tracing::debug!(
                    pda = %self.registry_pda,
                    error = %e,
                    "registry pda not readable"
                );
                return Ok(None);
            }
        };
        if acc.data.len() < 8 {
            return Err(ApiError::Internal(
                "registry account is smaller than Anchor discriminator".into(),
            ));
        }
        let (discriminator, body) = acc.data.split_at(8);
        // Anchor discriminator for `#[account] ModelRegistry` is the
        // first 8 bytes of sha256("account:ModelRegistry"). We do not
        // hard-code it because programs can rename the account, but
        // we do check that it is 8 non-zero bytes.
        if discriminator.iter().all(|b| *b == 0) {
            return Err(ApiError::Internal(
                "registry account has zero anchor discriminator".into(),
            ));
        }
        let acct: ModelRegistryAccount = BorshDeserialize::try_from_slice(body)
            .map_err(|e| ApiError::Internal(format!("registry decode failed: {}", e)))?;
        Ok(Some(acct))
    }

    pub fn registry_pda(&self) -> &Pubkey {
        &self.registry_pda
    }

    pub fn rpc(&self) -> Arc<RpcClient> {
        Arc::clone(&self.rpc)
    }
}
