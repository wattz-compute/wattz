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

    /// Human-facing owner label surfaced on `/v1/models`. Prefers the
    /// HuggingFace org slug from `hf_repo` (e.g. `openai/gpt-oss-20b`
    /// -> `openai`) and falls back to the base58 on-chain publisher key
    /// when no repo path is recorded.
    pub fn owned_by_label(&self) -> String {
        match self.hf_repo.split_once('/') {
            Some((org, _)) if !org.is_empty() => org.to_string(),
            _ => self.publisher_str(),
        }
    }
}

/// Canonical model catalog seeded into the in-memory cache when the
/// on-chain Model Registry PDA is empty (the devnet default today).
/// Mirrors exactly the five models the public surface advertises: three
/// relay-routable chat models and two catalogued-but-unserved models
/// awaiting a bare-metal node. The relay-live subset lines up with
/// `providers::groq`: every Groq-preferred routing id is a documented
/// alias of one of these three chat models (folded together by
/// `groq::map_model`), so `/v1/models` never advertises a relay model the
/// router won't serve and the router never relays an id the catalog omits.
pub fn canonical_catalog() -> Vec<ModelEntry> {
    fn entry(
        model_id: &str,
        display_name: &str,
        hf_repo: &str,
        license: &str,
        max_context: u32,
    ) -> ModelEntry {
        ModelEntry {
            model_id: model_id.to_string(),
            display_name: display_name.to_string(),
            hf_repo: hf_repo.to_string(),
            license: license.to_string(),
            config_hash: [0u8; 32],
            max_context,
            kyc_required: false,
            publisher: [0u8; 32],
            serving_nodes: Vec::new(),
        }
    }

    vec![
        entry(
            "llama-3.1-8b-instant",
            "Llama 3.1 8B Instant",
            "meta-llama/Llama-3.1-8B-Instruct",
            "Llama 3.1 Community License",
            131072,
        ),
        entry(
            "llama-3.3-70b-versatile",
            "Llama 3.3 70B Versatile",
            "meta-llama/Llama-3.3-70B-Instruct",
            "Llama 3.3 Community License",
            131072,
        ),
        entry(
            "gpt-oss-20b",
            "GPT-OSS 20B",
            "openai/gpt-oss-20b",
            "Apache-2.0",
            131072,
        ),
        entry(
            "whisper-large-v3",
            "Whisper Large v3",
            "openai/whisper-large-v3",
            "Apache-2.0",
            0,
        ),
        entry(
            "stable-diffusion-xl-1.0",
            "Stable Diffusion XL 1.0",
            "stabilityai/stable-diffusion-xl-base-1.0",
            "CreativeML Open RAIL++-M",
            0,
        ),
    ]
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::groq;

    #[test]
    fn canonical_catalog_has_the_five_public_models() {
        let cat = canonical_catalog();
        assert_eq!(cat.len(), 5);
        let ids: Vec<&str> = cat.iter().map(|m| m.model_id.as_str()).collect();
        for id in [
            "llama-3.1-8b-instant",
            "llama-3.3-70b-versatile",
            "gpt-oss-20b",
            "whisper-large-v3",
            "stable-diffusion-xl-1.0",
        ] {
            assert!(ids.contains(&id), "catalog missing {}", id);
        }
        // Retired models must never reappear on the catalog surface.
        assert!(!ids.iter().any(|id| id.contains("mistral")));
        assert!(!ids.iter().any(|id| id.contains("mixtral")));
        assert!(!ids.iter().any(|id| id.contains("gemma")));
    }

    #[test]
    fn exactly_three_catalog_models_are_relay_routable() {
        let relay = canonical_catalog()
            .iter()
            .filter(|m| groq::is_preferred(&m.model_id))
            .count();
        assert_eq!(relay, 3);
    }

    #[test]
    fn owned_by_label_uses_hf_org_slug() {
        let cat = canonical_catalog();
        let gpt = cat.iter().find(|m| m.model_id == "gpt-oss-20b").unwrap();
        assert_eq!(gpt.owned_by_label(), "openai");
        let llama = cat
            .iter()
            .find(|m| m.model_id == "llama-3.1-8b-instant")
            .unwrap();
        assert_eq!(llama.owned_by_label(), "meta-llama");
    }
}
