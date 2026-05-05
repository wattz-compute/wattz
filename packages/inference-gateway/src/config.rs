//! Runtime configuration loaded from process environment.
//!
//! All secrets (RPC keys, keypair paths, bootstrap tokens) live here.
//! `NEXT_PUBLIC_*` are never read on the gateway side -- the frontend
//! reads its own subset. The gateway rejects startup if any critical
//! field is malformed.

use anyhow::{anyhow, Context, Result};
use std::env;

/// Snapshot of environment variables at startup. Cloned via `Arc` inside
/// [`crate::state::AppState`].
#[derive(Clone, Debug)]
pub struct Config {
    /// TCP listen address, e.g. `0.0.0.0:8080`.
    pub listen_addr: String,

    /// CORS allow-list. Wildcards are forbidden per Wattz deployment rules.
    pub cors_origins: Vec<String>,

    /// Solana JSON-RPC endpoint. Server-side key is expected inline
    /// (`?api-key=...`) because we never leak this to the browser.
    pub solana_rpc_url: String,

    /// WebSocket endpoint. Used by the streaming payment module.
    pub solana_ws_url: Option<String>,

    /// Base58 program id of the deployed Anchor settlement program.
    pub anchor_program_id: String,

    /// Base58 program id of the Model Registry program (usually the
    /// same as the settlement program during v1, but kept separate so
    /// they can diverge later).
    pub model_registry_program_id: String,

    /// Model Registry PDA -- root account holding the model catalog.
    pub model_registry_pda: String,

    /// Path to a keypair file (JSON array of 64 bytes) that signs the
    /// `submit_inference` instructions. If unset, settlement is skipped
    /// but the gateway continues to serve traffic.
    pub anchor_keypair_path: Option<String>,

    /// URL of the always-online bootstrap node. Fallback when routing
    /// finds no candidates.
    pub bootstrap_node_http: String,

    /// Optional bearer token for the bootstrap node.
    pub bootstrap_node_token: Option<String>,

    /// Optional static node registry, used when the on-chain registry
    /// is empty (bootstrap phase). Format: JSON array of `NodeSpec`.
    pub static_nodes_json: Option<String>,

    /// HuggingFace token for model metadata lookups (license scraping).
    pub huggingface_token: Option<String>,

    /// Weight tuple for the routing engine `(price, latency, reputation)`.
    pub routing_weights: (f64, f64, f64),

    /// Timeout applied to upstream inference requests (seconds).
    pub upstream_timeout_secs: u64,

    /// Router health-check interval in seconds.
    pub health_interval_secs: u64,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let listen_addr = env::var("LISTEN_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".to_string());

        let cors_origins = env::var("CORS_ORIGINS")
            .unwrap_or_else(|_| {
                "https://wattz-web.vercel.app,https://wattz.fi,https://www.wattz.fi,http://localhost:3000".to_string()
            })
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>();

        if cors_origins.iter().any(|o| o == "*") {
            return Err(anyhow!(
                "CORS wildcard '*' is forbidden -- explicit origins required"
            ));
        }

        let solana_rpc_url = env::var("SOLANA_RPC_URL")
            .or_else(|_| env::var("HELIUS_RPC_URL"))
            .unwrap_or_else(|_| "https://api.mainnet-beta.solana.com".to_string());

        let solana_ws_url = env::var("HELIUS_WS_URL").ok();

        let anchor_program_id = env::var("ANCHOR_PROGRAM_ID")
            .or_else(|_| env::var("NEXT_PUBLIC_2_PROGRAM_ID"))
            .unwrap_or_else(|_| "11111111111111111111111111111111".to_string());

        let model_registry_program_id = env::var("MODEL_REGISTRY_PROGRAM_ID")
            .unwrap_or_else(|_| anchor_program_id.clone());

        let model_registry_pda = env::var("MODEL_REGISTRY_PDA")
            .unwrap_or_else(|_| "11111111111111111111111111111111".to_string());

        let anchor_keypair_path = env::var("ANCHOR_KEYPAIR").ok();

        let bootstrap_node_http = env::var("BOOTSTRAP_NODE_HTTP")
            .unwrap_or_else(|_| "http://127.0.0.1:8081".to_string());
        let bootstrap_node_token = env::var("BOOTSTRAP_NODE_TOKEN").ok();

        let static_nodes_json = env::var("WATTZ_STATIC_NODES").ok();

        let huggingface_token = env::var("HUGGINGFACE_TOKEN").ok();

        let routing_weights = parse_weights(&env::var("ROUTING_WEIGHTS").unwrap_or_default())
            .unwrap_or((1.0, 0.6, 0.4));

        let upstream_timeout_secs = env::var("UPSTREAM_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(300);

        let health_interval_secs = env::var("HEALTH_INTERVAL_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(30);

        Ok(Self {
            listen_addr,
            cors_origins,
            solana_rpc_url,
            solana_ws_url,
            anchor_program_id,
            model_registry_program_id,
            model_registry_pda,
            anchor_keypair_path,
            bootstrap_node_http,
            bootstrap_node_token,
            static_nodes_json,
            huggingface_token,
            routing_weights,
            upstream_timeout_secs,
            health_interval_secs,
        })
    }
}

fn parse_weights(raw: &str) -> Result<(f64, f64, f64)> {
    let parts: Vec<&str> = raw.split(',').map(|s| s.trim()).collect();
    if parts.len() != 3 {
        return Err(anyhow!("expected `price,latency,reputation` triple"));
    }
    let price = parts[0].parse::<f64>().context("bad price weight")?;
    let latency = parts[1].parse::<f64>().context("bad latency weight")?;
    let reputation = parts[2].parse::<f64>().context("bad reputation weight")?;
    Ok((price, latency, reputation))
}
