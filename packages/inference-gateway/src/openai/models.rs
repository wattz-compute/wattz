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
        .map(|m| ModelObject {
            id: m.model_id.clone(),
            object_kind: "model",
            created,
            owned_by: m.publisher_str(),
            license: m.license.clone(),
            max_context: m.max_context,
            kyc_required: m.kyc_required,
            serving_nodes: m.serving_nodes.len(),
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
