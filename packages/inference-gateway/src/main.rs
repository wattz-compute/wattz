//! Wattz Inference Gateway binary entrypoint.
//!
//! Boots an axum server that exposes OpenAI-compatible endpoints, routes
//! inference requests to registered GPU nodes, verifies TEE attestation
//! and ZK proofs, and submits settlement receipts to the Wattz Anchor
//! program on Solana (devnet today; mainnet planned).

use anyhow::{Context, Result};
use std::net::SocketAddr;
use tracing_subscriber::EnvFilter;
use wattz_inference_gateway::{build_router, config::Config, state::AppState};

#[tokio::main]
async fn main() -> Result<()> {
    // Load environment. Absence of `.env` is not fatal in production
    // where Railway injects variables directly.
    let _ = dotenvy::dotenv();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,wattz_inference_gateway=debug")),
        )
        .with_target(true)
        .init();

    let cfg = Config::from_env().context("failed to load gateway configuration")?;
    let addr: SocketAddr = cfg
        .listen_addr
        .parse()
        .with_context(|| format!("invalid LISTEN_ADDR: {}", cfg.listen_addr))?;

    tracing::info!(
        %addr,
        cluster = %cfg.solana_rpc_url,
        program_id = %cfg.anchor_program_id,
        registry_pda = %cfg.model_registry_pda,
        bootstrap = %cfg.bootstrap_node_http,
        "wattz-inference-gateway starting"
    );

    let state = AppState::new(cfg).await?;
    let router = build_router(state);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .with_context(|| format!("failed to bind on {}", addr))?;
    tracing::info!(%addr, "listening");
    // `with_connect_info` exposes the peer socket address to the rate
    // limiter as a fallback when the forwarded client-IP headers are
    // absent (direct connections, non-proxied local runs).
    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;
    Ok(())
}
