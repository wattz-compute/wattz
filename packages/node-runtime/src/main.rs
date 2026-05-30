//! Wattz GPU node runtime binary entrypoint.
//!
//! Boots an axum server that accepts inference requests from the
//! Wattz inference gateway, dispatches them to the configured backend
//! (Ollama, vLLM, or TGI), attaches a TEE attestation envelope to every
//! response, and heartbeats its capabilities to the gateway.

use anyhow::{Context, Result};
use std::net::SocketAddr;
use tracing_subscriber::EnvFilter;
use wattz_node_runtime::{build_router, config::Config, heartbeat, state::NodeState};

#[tokio::main]
async fn main() -> Result<()> {
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,wattz_node_runtime=debug")),
        )
        .with_target(true)
        .init();

    let cfg = Config::from_env().context("failed to load node-runtime config")?;
    let addr: SocketAddr = cfg
        .listen_addr
        .parse()
        .with_context(|| format!("invalid NODE_HTTP_LISTEN: {}", cfg.listen_addr))?;

    tracing::info!(
        node_id = %cfg.node_id,
        backend = ?cfg.backend,
        gateway = %cfg.gateway_url,
        listen = %addr,
        "wattz-node-runtime starting"
    );

    let state = NodeState::new(cfg).await?;

    // Kick off the heartbeat loop in the background. The runtime keeps
    // running even if the gateway is briefly unreachable; the loop retries
    // with exponential backoff.
    let heartbeat_state = state.clone();
    tokio::spawn(async move { heartbeat::run(heartbeat_state).await });

    let router = build_router(state);
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("failed to bind on {}", addr))?;
    tracing::info!(%addr, "listening");
    axum::serve(listener, router.into_make_service()).await?;
    Ok(())
}
