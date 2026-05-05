//! Wattz Inference Gateway -- library surface.
//!
//! Splits into modules mirroring the runtime pipeline:
//!
//! 1. `openai::` -- OpenAI-compatible HTTP surface (`/v1/chat/completions`,
//!    `/v1/embeddings`, `/v1/images/generations`, `/v1/models`).
//! 2. `routing::` -- pool of registered GPU nodes + scoring engine that
//!    picks the best node per request.
//! 3. `attestation::` -- verifies TEE quotes (Intel SGX DCAP, AMD SEV-SNP,
//!    NVIDIA Confidential Computing) and Risc0 / SP1 receipt commitments
//!    returned by nodes.
//! 4. `registry::` -- reads the on-chain Model Registry PDA (Anchor) via
//!    Solana JSON-RPC.
//! 5. `settlement::` -- packs an `InferenceReceipt` and submits it as an
//!    Anchor instruction (`submit_inference`) on Solana mainnet.
//! 6. `proxy::` -- transparent request forwarding + streaming SSE relay.
//! 7. `metrics::` -- Prometheus counters exposed on `/metrics`.

pub mod attestation;
pub mod config;
pub mod error;
pub mod metrics;
pub mod openai;
pub mod proxy;
pub mod registry;
pub mod routing;
pub mod settlement;
pub mod state;

use axum::{
    routing::{get, post},
    Router,
};
use std::time::Duration;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};

use crate::state::AppState;

/// Build the top-level axum router with all routes, CORS, tracing, and
/// compression middleware attached.
pub fn build_router(state: AppState) -> Router {
    let origins: Vec<axum::http::HeaderValue> = state
        .config
        .cors_origins
        .iter()
        .filter_map(|o| o.parse::<axum::http::HeaderValue>().ok())
        .collect();

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_credentials(true)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
            axum::http::HeaderName::from_static("x-wattz-node"),
            axum::http::HeaderName::from_static("x-wattz-attestation"),
        ])
        .max_age(Duration::from_secs(600));

    Router::new()
        .route("/healthz", get(openai::models::healthz))
        .route("/readyz", get(openai::models::readyz))
        .route("/metrics", get(metrics::render))
        .route("/v1/models", get(openai::models::list_models))
        .route("/v1/chat/completions", post(openai::chat::create_completion))
        .route("/v1/embeddings", post(openai::embeddings::create_embeddings))
        .route("/v1/images/generations", post(openai::images::create_image))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
