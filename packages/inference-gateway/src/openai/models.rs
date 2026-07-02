//! `/v1/models`, `/healthz`, `/readyz`.

use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use chrono::Utc;
use serde_json::json;

use crate::openai::types::{ModelObject, ModelsList};
use crate::state::AppState;

/// Simple liveness probe. Always returns 200 while the process is up.
pub async fn healthz() -> impl IntoResponse {
    (StatusCode::OK, Json(json!({ "status": "ok" })))
}

/// Readiness probe. The gateway is ready when at least one healthy node
/// is available in the routing pool -- otherwise upstream traffic will
/// fail immediately.
pub async fn readyz(State(state): State<AppState>) -> impl IntoResponse {
    let pool_size = state.routing.pool().len();
    let healthy = state.routing.pool().healthy_count();
    if healthy == 0 && state.config.bootstrap_node_http.is_empty() {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "status": "not_ready",
                "reason": "no healthy nodes and no bootstrap fallback",
                "pool_size": pool_size,
            })),
        );
    }
    (
        StatusCode::OK,
        Json(json!({
            "status": "ready",
            "pool_size": pool_size,
            "healthy_nodes": healthy,
            "program_id": state.config.anchor_program_id,
        })),
    )
}

/// `GET /v1/models` -- returns the Model Registry snapshot in OpenAI
/// format.
pub async fn list_models(State(state): State<AppState>) -> impl IntoResponse {
    let snapshot = state.model_catalog();
    let created = Utc::now().timestamp();
    let data: Vec<ModelObject> = snapshot
        .iter()
        .map(|m| {
            let serving_nodes = m.serving_nodes.len();
            let status = if serving_nodes > 0 {
                "live"
            } else if crate::providers::groq::is_preferred(&m.model_id) {
                "relay"
            } else {
                "awaiting node"
            };
            ModelObject {
                id: m.model_id.clone(),
                object_kind: "model",
                created,
                owned_by: m.owned_by_label(),
                display_name: m.display_name.clone(),
                license: m.license.clone(),
                max_context: m.max_context,
                kyc_required: m.kyc_required,
                serving_nodes,
                status,
            }
        })
        .collect();
    (
        StatusCode::OK,
        Json(ModelsList {
            object: "list",
            data,
        }),
    )
}

/// `GET /v1/network/stats` -- live gateway telemetry sourced entirely
/// from process state: uptime, the lifetime request counter, catalog
/// counts, external node count, and whether the relay path is enabled.
/// No fabricated counters.
pub async fn network_stats(State(state): State<AppState>) -> impl IntoResponse {
    let body = build_network_stats(
        state.uptime_seconds(),
        state
            .requests_total
            .load(std::sync::atomic::Ordering::Relaxed),
        state.model_catalog().len(),
        state.relay_live_count(),
        state.external_node_count(),
        state.groq.is_some(),
    );
    (StatusCode::OK, Json(body))
}

/// Pure builder for the `/v1/network/stats` body, split out so the shape
/// can be unit-tested without constructing a full [`AppState`].
fn build_network_stats(
    uptime_seconds: u64,
    requests_total: u64,
    models_catalog: usize,
    models_relay_live: usize,
    external_nodes: usize,
    relay_active: bool,
) -> serde_json::Value {
    json!({
        "uptime_seconds": uptime_seconds,
        "requests_total": requests_total,
        "models_catalog": models_catalog,
        "models_relay_live": models_relay_live,
        "external_nodes": external_nodes,
        "relay_active": relay_active,
    })
}

#[cfg(test)]
mod tests {
    use super::build_network_stats;

    #[test]
    fn network_stats_shape_is_stable_and_honest() {
        let v = build_network_stats(1200, 42, 5, 3, 0, true);
        assert_eq!(v["uptime_seconds"], 1200);
        assert_eq!(v["requests_total"], 42);
        assert_eq!(v["models_catalog"], 5);
        assert_eq!(v["models_relay_live"], 3);
        assert_eq!(v["external_nodes"], 0);
        assert_eq!(v["relay_active"], true);
        // Object has exactly the six documented keys -- no stray fabricated
        // counters (gpuNodes / TFLOPS / inferences-per-day / TEE counts).
        assert_eq!(v.as_object().unwrap().len(), 6);
    }
}
