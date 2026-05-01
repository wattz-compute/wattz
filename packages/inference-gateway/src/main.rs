//! Wattz inference gateway. axum binary that hosts the OpenAI-compatible
//! HTTP surface and forwards requests to registered GPU nodes.

use std::net::SocketAddr;

use anyhow::Result;
use tracing_subscriber::EnvFilter;
use wattz_inference_gateway::{build_router, config::Config, state::AppState};

#[tokio::main]
async fn main() -> Result<()> {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::fmt().with_env_filter(filter).init();

    let config = Config::from_env()?;
    let state = AppState::new(config).await?;
    let listen: SocketAddr = state.config.listen.parse()?;

    tracing::info!(%listen, "starting wattz gateway");
    let listener = tokio::net::TcpListener::bind(listen).await?;
    axum::serve(listener, build_router(state)).await?;
    Ok(())
}
