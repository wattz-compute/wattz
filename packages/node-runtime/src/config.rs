//! Runtime configuration loaded from environment + optional YAML.
//!
//! Every knob has a sensible default so a fresh checkout can boot with
//! `cargo run` and connect to a local Ollama daemon.

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Backend {
    Ollama,
    Vllm,
    Tgi,
}

impl Backend {
    fn parse(s: &str) -> Result<Self> {
        match s.to_ascii_lowercase().as_str() {
            "ollama" => Ok(Self::Ollama),
            "vllm" => Ok(Self::Vllm),
            "tgi" => Ok(Self::Tgi),
            other => Err(anyhow!("unknown backend: {}", other)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSpec {
    pub name: String,
    pub context_window: u32,
    pub price_per_1k_input_tokens: f64,
    pub price_per_1k_output_tokens: f64,
    pub license: String,
    #[serde(default)]
    pub kyc_required: bool,
}

#[derive(Debug, Clone)]
pub struct Config {
    pub node_id: String,
    pub region: String,
    pub gateway_url: String,
    pub bootstrap_token: String,
    pub listen_addr: String,
    pub backend: Backend,
    pub backend_url: String,
    pub attestation_key_file: Option<PathBuf>,
    pub attestation_type: String,
    pub heartbeat_interval: Duration,
    pub models: Vec<ModelSpec>,
    pub payout_address: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let node_id = std::env::var("WATTZ_NODE_ID")
            .unwrap_or_else(|_| default_node_id());
        let region = std::env::var("WATTZ_NODE_REGION").unwrap_or_else(|_| "us-east".into());
        let gateway_url = std::env::var("INFERENCE_GATEWAY_URL")
            .unwrap_or_else(|_| "http://localhost:8080".into());
        let bootstrap_token = std::env::var("BOOTSTRAP_NODE_TOKEN").unwrap_or_else(|_| String::new());
        let listen_addr = std::env::var("NODE_HTTP_LISTEN").unwrap_or_else(|_| "0.0.0.0:8081".into());
        let backend = Backend::parse(
            &std::env::var("WATTZ_NODE_BACKEND").unwrap_or_else(|_| "ollama".into()),
        )?;
        let backend_url = std::env::var("WATTZ_NODE_BACKEND_URL")
            .unwrap_or_else(|_| default_backend_url(backend).into());
        let attestation_key_file = std::env::var("WATTZ_NODE_ATT_KEY")
            .ok()
            .map(PathBuf::from);
        let attestation_type =
            std::env::var("WATTZ_NODE_TEE").unwrap_or_else(|_| "software".into());
        let heartbeat_interval = Duration::from_secs(
            std::env::var("WATTZ_HEARTBEAT_INTERVAL_SECS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(30),
        );
        let payout_address = std::env::var("WATTZ_PAYOUT_ADDRESS").unwrap_or_else(|_| String::new());

        let models = load_models()?;

        Ok(Self {
            node_id,
            region,
            gateway_url,
            bootstrap_token,
            listen_addr,
            backend,
            backend_url,
            attestation_key_file,
            attestation_type,
            heartbeat_interval,
            models,
            payout_address,
        })
    }
}

fn default_node_id() -> String {
    format!("node-{}", &uuid::Uuid::new_v4().to_string()[..8])
}

fn default_backend_url(backend: Backend) -> &'static str {
    match backend {
        Backend::Ollama => "http://localhost:11434",
        Backend::Vllm => "http://localhost:8000",
        Backend::Tgi => "http://localhost:3000",
    }
}

fn load_models() -> Result<Vec<ModelSpec>> {
    // Prefer WATTZ_MODELS_FILE (YAML) if present, otherwise fall back to a
    // built-in default that mirrors the models the Wattz bootstrap nodes
    // are launched with.
    if let Ok(path) = std::env::var("WATTZ_MODELS_FILE") {
        let text = std::fs::read_to_string(&path)
            .with_context(|| format!("failed to read models file {}", path))?;
        let doc: ModelsDoc = serde_yaml::from_str(&text)
            .with_context(|| format!("failed to parse models file {}", path))?;
        return Ok(doc.models);
    }
    Ok(default_models())
}

#[derive(Debug, Deserialize)]
struct ModelsDoc {
    models: Vec<ModelSpec>,
}

fn default_models() -> Vec<ModelSpec> {
    vec![
        ModelSpec {
            name: "llama-3-8b-instruct".into(),
            context_window: 8192,
            price_per_1k_input_tokens: 0.10,
            price_per_1k_output_tokens: 0.20,
            license: "Meta Llama 3 Community License".into(),
            kyc_required: false,
        },
        ModelSpec {
            name: "mistral-7b-instruct".into(),
            context_window: 32768,
            price_per_1k_input_tokens: 0.08,
            price_per_1k_output_tokens: 0.16,
            license: "Apache-2.0".into(),
            kyc_required: false,
        },
        ModelSpec {
            name: "whisper-base".into(),
            context_window: 0,
            price_per_1k_input_tokens: 0.00,
            price_per_1k_output_tokens: 0.03,
            license: "MIT".into(),
            kyc_required: false,
        },
    ]
}
