//! Shared application state.
//!
//! [`AppState`] is the type carried by every handler. It is cheap to
//! clone (`Arc` internally) and thread-safe. Construction wires up the
//! registry client, routing engine, node proxy, settlement client, and
//! metrics recorder in one place.

use anyhow::Result;
use parking_lot::RwLock;
use std::sync::atomic::AtomicU64;
use std::sync::Arc;
use std::time::{Duration, Instant};

use crate::config::Config;
use crate::metrics::Metrics;
use crate::providers::GroqProvider;
use crate::proxy::NodeProxy;
use crate::registry::{ModelEntry, RegistryClient};
use crate::routing::{
    node_pool::{NodeCapability, NodePool, NodeSpec},
    RoutingEngine,
};
use crate::settlement::SettlementClient;

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub metrics: Metrics,
    pub proxy: Arc<NodeProxy>,
    pub routing: Arc<RoutingEngine>,
    pub settlement: Arc<SettlementClient>,
    pub registry: Arc<RegistryClient>,
    /// Groq proxy provider. `None` when `GROQ_API_KEY` is unset or the
    /// operator has explicitly disabled the fallback with
    /// `GROQ_FALLBACK_ENABLED=false`.
    pub groq: Option<Arc<GroqProvider>>,
    /// Process boot instant, used to report gateway uptime on
    /// `/v1/network/stats`.
    pub started_at: Instant,
    /// Lifetime count of well-formed inference requests, incremented by
    /// the chat handler and surfaced on `/v1/network/stats`.
    pub requests_total: Arc<AtomicU64>,
    catalog: Arc<RwLock<Vec<ModelEntry>>>,
}

impl AppState {
    pub async fn new(config: Config) -> Result<Self> {
        let metrics = Metrics::new();

        // Node pool starts with any static / bootstrap-injected nodes.
        let pool = NodePool::new();
        let static_nodes = parse_static_nodes(&config)?;
        if !static_nodes.is_empty() {
            pool.set(static_nodes.clone());
            tracing::info!(count = static_nodes.len(), "seeded node pool from WATTZ_STATIC_NODES");
        }

        let bootstrap_fallback = if config.bootstrap_node_http.is_empty() {
            None
        } else {
            Some(default_bootstrap_node(&config))
        };

        let routing = Arc::new(RoutingEngine::new(
            pool.clone(),
            config.routing_weights,
            bootstrap_fallback.clone(),
        ));
        if let Some(node) = bootstrap_fallback.as_ref() {
            pool.upsert_many(vec![node.clone()]);
        }

        let proxy = Arc::new(NodeProxy::new(Duration::from_secs(
            config.upstream_timeout_secs,
        )));

        let groq = if config.groq_fallback_enabled {
            match config.groq_api_key.as_ref() {
                Some(key) => {
                    tracing::info!(
                        base_url = %config.groq_base_url,
                        "groq fallback provider enabled"
                    );
                    Some(Arc::new(GroqProvider::new(
                        key.clone(),
                        config.groq_base_url.clone(),
                        Duration::from_secs(config.upstream_timeout_secs),
                    )))
                }
                None => {
                    tracing::warn!(
                        "GROQ_FALLBACK_ENABLED set but GROQ_API_KEY is missing; \
                         Groq fallback disabled"
                    );
                    None
                }
            }
        } else {
            None
        };

        let settlement = Arc::new(SettlementClient::new(
            config.solana_rpc_url.clone(),
            &config.anchor_program_id,
            config.anchor_keypair_path.as_deref(),
        )?);

        let registry = Arc::new(RegistryClient::new(
            config.solana_rpc_url.clone(),
            &config.model_registry_pda,
        )?);

        let catalog: Arc<RwLock<Vec<ModelEntry>>> = Arc::new(RwLock::new(Vec::new()));
        // Best-effort initial fetch. Do not fail startup if the PDA is
        // unavailable -- the bootstrap phase may run before Anchor is
        // deployed.
        match registry.fetch().await {
            Ok(Some(acc)) => {
                tracing::info!(
                    models = acc.models.len(),
                    slot = acc.last_updated_slot,
                    "registry snapshot loaded"
                );
                *catalog.write() = acc.models;
            }
            Ok(None) => tracing::warn!("registry PDA empty; using bootstrap models only"),
            Err(e) => tracing::warn!(%e, "registry fetch failed at boot; continuing"),
        }

        // Seed the canonical catalog when the on-chain registry has not
        // populated it yet (devnet default). Keeps `/v1/models` in sync
        // with the public surface instead of returning an empty list.
        if catalog.read().is_empty() {
            let seed = crate::registry::canonical_catalog();
            tracing::info!(models = seed.len(), "seeded canonical model catalog");
            *catalog.write() = seed;
        }

        // Background refresh loops.
        let this = Self {
            config: Arc::new(config),
            metrics,
            proxy,
            routing,
            settlement,
            registry,
            groq,
            started_at: Instant::now(),
            requests_total: Arc::new(AtomicU64::new(0)),
            catalog,
        };
        this.spawn_background_loops();
        Ok(this)
    }

    /// Snapshot of the current model catalog.
    pub fn model_catalog(&self) -> Vec<ModelEntry> {
        self.catalog.read().clone()
    }

    /// Find a model by id.
    pub fn model_by_id(&self, model_id: &str) -> Option<ModelEntry> {
        self.catalog
            .read()
            .iter()
            .find(|m| m.model_id == model_id)
            .cloned()
    }

    /// Whole-number seconds since the gateway process started.
    pub fn uptime_seconds(&self) -> u64 {
        self.started_at.elapsed().as_secs()
    }

    /// Count of catalogued models that are servable right now via the
    /// Groq relay path.
    pub fn relay_live_count(&self) -> usize {
        self.catalog
            .read()
            .iter()
            .filter(|m| crate::providers::groq::is_preferred(&m.model_id))
            .count()
    }

    /// Count of external (non-bootstrap) nodes registered in the pool.
    pub fn external_node_count(&self) -> usize {
        self.routing
            .pool()
            .snapshot()
            .iter()
            .filter(|n| !n.bootstrap)
            .count()
    }

    fn spawn_background_loops(&self) {
        // Registry refresh.
        {
            let registry = self.registry.clone();
            let catalog = self.catalog.clone();
            let interval = std::time::Duration::from_secs(120);
            tokio::spawn(async move {
                loop {
                    tokio::time::sleep(interval).await;
                    match registry.fetch().await {
                        // Only replace the catalog with a non-empty on-chain
                        // snapshot; an empty one keeps the canonical seed.
                        Ok(Some(acc)) if !acc.models.is_empty() => {
                            tracing::debug!(models = acc.models.len(), "registry refresh");
                            *catalog.write() = acc.models;
                        }
                        Ok(Some(_)) => tracing::debug!("registry refresh: PDA has no models; keeping seed"),
                        Ok(None) => tracing::debug!("registry refresh: PDA empty"),
                        Err(e) => tracing::warn!(%e, "registry refresh failed"),
                    }
                }
            });
        }

        // Health probes.
        {
            let pool = self.routing.pool().clone();
            let interval = self.config.health_interval_secs;
            tokio::spawn(async move {
                let checker = crate::routing::health::HealthChecker::new(pool, interval);
                checker.run_forever().await;
            });
        }
    }
}

fn parse_static_nodes(cfg: &Config) -> Result<Vec<NodeSpec>> {
    let Some(raw) = cfg.static_nodes_json.as_ref() else {
        return Ok(Vec::new());
    };
    let nodes: Vec<NodeSpec> = serde_json::from_str(raw)?;
    Ok(nodes)
}

fn default_bootstrap_node(cfg: &Config) -> NodeSpec {
    NodeSpec {
        node_pubkey: "BootstrapNode111111111111111111111111111111".to_string(),
        http_endpoint: cfg.bootstrap_node_http.clone(),
        auth_token: cfg.bootstrap_node_token.clone(),
        region: "US-WEST".to_string(),
        capabilities: default_bootstrap_capabilities(),
        reputation: 0.9,
        latency_ms: 0,
        healthy: true,
        bootstrap: true,
    }
}

/// The bootstrap node always ships with the base model set so we can
/// serve `/v1/chat/completions` even before any operator registers. Ids
/// mirror the canonical catalog; the placeholder node advertises no TEE
/// because it carries no verifiable attestation.
fn default_bootstrap_capabilities() -> Vec<NodeCapability> {
    vec![
        NodeCapability {
            model_id: "llama-3-8b".into(),
            price_per_1k_lamports: 400,
            max_context: 131072,
            tee: false,
        },
        NodeCapability {
            model_id: "llama-3.1-8b-instant".into(),
            price_per_1k_lamports: 400,
            max_context: 131072,
            tee: false,
        },
        NodeCapability {
            model_id: "llama-3.3-70b-versatile".into(),
            price_per_1k_lamports: 2400,
            max_context: 131072,
            tee: false,
        },
        NodeCapability {
            model_id: "gpt-oss-20b".into(),
            price_per_1k_lamports: 600,
            max_context: 131072,
            tee: false,
        },
        NodeCapability {
            model_id: "stable-diffusion-xl-1.0".into(),
            price_per_1k_lamports: 5000,
            max_context: 0,
            tee: false,
        },
        NodeCapability {
            model_id: "whisper-large-v3".into(),
            price_per_1k_lamports: 200,
            max_context: 0,
            tee: false,
        },
    ]
}
