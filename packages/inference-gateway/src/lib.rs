//! Wattz Inference Gateway -- library surface. Skeleton, follow-up commits
//! wire in each module.

pub mod config;
pub mod error;
pub mod state;

use axum::{routing::get, Router};

use crate::state::AppState;

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(|| async { "ok" }))
        .with_state(state)
}
