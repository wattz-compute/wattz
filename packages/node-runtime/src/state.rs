//! Shared runtime state.

use crate::attestation::AttestationSigner;
use crate::config::Config;
use crate::inference::{new_backend, InferenceBackend};
use crate::metrics::MetricsRegistry;
use anyhow::Result;
use std::sync::Arc;

/// Shared handle passed to every axum route.
#[derive(Clone)]
pub struct NodeState {
    pub config: Arc<Config>,
    pub backend: Arc<dyn InferenceBackend>,
    pub signer: Arc<AttestationSigner>,
    pub metrics: Arc<MetricsRegistry>,
    pub started_at: chrono::DateTime<chrono::Utc>,
}

impl NodeState {
    pub async fn new(cfg: Config) -> Result<Self> {
        let backend = new_backend(cfg.backend, cfg.backend_url.clone())?;
        let signer = AttestationSigner::load_or_generate(cfg.attestation_key_file.as_deref())?;
        let metrics = MetricsRegistry::new()?;
        Ok(Self {
            config: Arc::new(cfg),
            backend: Arc::from(backend),
            signer: Arc::new(signer),
            metrics: Arc::new(metrics),
            started_at: chrono::Utc::now(),
        })
    }
}
