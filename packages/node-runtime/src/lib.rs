//! Wattz GPU node runtime library.
//!
//! Modules mirror the runtime pipeline:
//!
//! - `config` -- environment + YAML loading.
//! - `state` -- shared runtime state (backend handle, attestation signer,
//!   Prometheus registry).
//! - `inference` -- Ollama / vLLM / TGI backend clients that expose a
//!   uniform `InferenceBackend` trait.
//! - `models` -- model loader / registry helpers.
//! - `attestation` -- signs each response with an ed25519 key and, when
//!   available, wraps the payload in a real TEE quote using the
//!   `wattz-compute-verifier` envelope format.
//! - `heartbeat` -- periodic status POST to the gateway.
//! - `server` -- axum HTTP surface (`/v1/chat/completions`, `/v1/models`,
//!   `/healthz`, `/readyz`).
//! - `metrics` -- Prometheus exposition and instrumentation.

pub mod attestation;
pub mod config;
pub mod heartbeat;
pub mod inference;
pub mod metrics;
pub mod models;
pub mod server;
pub mod state;

use axum::{
    routing::{get, post},
    Router,
};

pub use state::NodeState;

/// Build the top-level axum router with all node-runtime routes attached.
pub fn build_router(state: NodeState) -> Router {
    Router::new()
        .route("/healthz", get(server::healthz))
        .route("/readyz", get(server::readyz))
        .route("/metrics", get(metrics::render))
        .route("/v1/models", get(server::list_models))
        .route("/v1/chat/completions", post(server::chat_completions))
        .route("/v1/embeddings", post(server::embeddings))
        .with_state(state)
}
