//! Heartbeat loop.
//!
//! Every `WATTZ_HEARTBEAT_INTERVAL_SECS` (default 30) the runtime sends a
//! POST to `{gateway_url}/internal/heartbeat` describing its capabilities.
//! The gateway uses the payload to refresh its routing pool.

use crate::state::NodeState;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::sleep;

#[derive(Debug, Clone, Serialize)]
pub struct Heartbeat {
    pub node_id: String,
    pub region: String,
    pub backend: String,
    pub attestation_type: String,
    pub public_key_hex: String,
    pub uptime_seconds: i64,
    pub loaded_models: Vec<String>,
    pub configured_models: Vec<String>,
    pub gpu: GpuTelemetry,
    pub version: &'static str,
    pub payout_address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GpuTelemetry {
    pub total_memory_mib: u64,
    pub free_memory_mib: u64,
    pub cpu_load: f32,
    pub num_cpus: usize,
}

pub async fn run(state: NodeState) {
    let mut backoff = state.config.heartbeat_interval;
    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .expect("build reqwest client");

    loop {
        match send_once(&state, &http).await {
            Ok(()) => {
                backoff = state.config.heartbeat_interval;
                sleep(state.config.heartbeat_interval).await;
            }
            Err(err) => {
                tracing::warn!(?err, "heartbeat failed, retrying");
                backoff = (backoff * 2).min(Duration::from_secs(300));
                sleep(backoff).await;
            }
        }
    }
}

async fn send_once(state: &NodeState, http: &reqwest::Client) -> anyhow::Result<()> {
    let uptime = (chrono::Utc::now() - state.started_at).num_seconds().max(0);
    let loaded = state.backend.list_models().await.unwrap_or_default();
    let configured: Vec<String> = state.config.models.iter().map(|m| m.name.clone()).collect();
    let gpu = read_gpu_telemetry();
    let hb = Heartbeat {
        node_id: state.config.node_id.clone(),
        region: state.config.region.clone(),
        backend: state.backend.name().to_string(),
        attestation_type: state.config.attestation_type.clone(),
        public_key_hex: hex::encode(state.signer.public_key_bytes()),
        uptime_seconds: uptime,
        loaded_models: loaded,
        configured_models: configured,
        gpu,
        version: env!("CARGO_PKG_VERSION"),
        payout_address: state.config.payout_address.clone(),
    };
    let url = format!(
        "{}/internal/heartbeat",
        state.config.gateway_url.trim_end_matches('/')
    );
    let mut req = http.post(&url).json(&hb);
    if !state.config.bootstrap_token.is_empty() {
        req = req.bearer_auth(&state.config.bootstrap_token);
    }
    let resp = req.send().await?;
    if !resp.status().is_success() {
        anyhow::bail!("heartbeat rejected: {}", resp.status());
    }
    state.metrics.record_heartbeat_success();
    Ok(())
}

fn read_gpu_telemetry() -> GpuTelemetry {
    // sysinfo gives us CPU + RAM but not GPU-specific data. Nodes that
    // want to expose NVML metrics can side-load a small daemon that
    // writes to /tmp/wattz-gpu.json; we merge that in when present.
    let mut sys = sysinfo::System::new_all();
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu_load = sys.global_cpu_usage();
    let num_cpus = sys.cpus().len();

    let mut telemetry = GpuTelemetry {
        total_memory_mib: 0,
        free_memory_mib: 0,
        cpu_load,
        num_cpus,
    };

    if let Ok(text) = std::fs::read_to_string("/tmp/wattz-gpu.json") {
        if let Ok(raw) = serde_json::from_str::<GpuTelemetry>(&text) {
            telemetry.total_memory_mib = raw.total_memory_mib;
            telemetry.free_memory_mib = raw.free_memory_mib;
        }
    }

    telemetry
}
