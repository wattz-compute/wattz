//! `/v1/images/generations`.

use axum::{
    extract::State,
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use serde_json::{json, Value};

use crate::error::{ApiError, ApiResult};
use crate::openai::types::ImageRequest;
use crate::settlement::InferenceReceipt;
use crate::state::AppState;

pub async fn create_image(
    State(state): State<AppState>,
    Json(req): Json<ImageRequest>,
) -> ApiResult<Response> {
    let started_at = Utc::now();
    let start_instant = std::time::Instant::now();
    if req.model.is_empty() {
        return Err(ApiError::BadRequest("model is required".into()));
    }
    if req.prompt.is_empty() {
        return Err(ApiError::BadRequest("prompt is required".into()));
    }

    let selection = state
        .routing
        .pick(&req.model, req.wattz_region.as_deref(), 0.0)?;
    let request_id = uuid::Uuid::new_v4();
    let request_id_str = request_id.to_string();
    let upstream_body = serde_json::to_value(req.clone().strip_wattz_extensions())?;

    let (mut response_json, attestation_envelope) = state
        .proxy
        .forward_json(
            &selection,
            "/v1/images/generations",
            &request_id_str,
            &upstream_body,
        )
        .await?;

    let attestation_outcome = match attestation_envelope.as_ref() {
        Some(env) => Some(crate::attestation::verify(env)?),
        None => None,
    };

    // Images are priced per image, not per token. We treat each image
    // as 1000 "tokens" of billing units so the same price_per_1k
    // gauge applies uniformly.
    let images_requested = req.n.unwrap_or(1) as u64;
    let price_lamports = selection
        .price_per_1k_lamports
        .saturating_mul(images_requested);

    let receipt = InferenceReceipt {
        request_id,
        model_id: req.model.clone(),
        input_tokens: 0,
        output_tokens: (images_requested as u32).saturating_mul(1000),
        price_lamports,
        node_pubkey: selection.node_pubkey.clone(),
        region: selection.region.clone(),
        started_at,
        completed_at: Utc::now(),
        attestation: attestation_outcome.clone(),
    };
    let settlement_summary = state.settlement.submit(&receipt).await.ok();

    if let Value::Object(map) = &mut response_json {
        map.insert(
            "wattz".into(),
            json!({
                "request_id": request_id_str,
                "node": {
                    "pubkey": selection.node_pubkey,
                    "region": selection.region,
                    "reputation": selection.reputation,
                    "price_per_1k_lamports": selection.price_per_1k_lamports,
                },
                "attestation": attestation_outcome,
                "settlement": settlement_summary,
                "price_lamports": price_lamports,
                "images_generated": images_requested,
            }),
        );
    }

    state
        .metrics
        .requests_total
        .with_label_values(&["images", "ok"])
        .inc();
    state
        .metrics
        .request_latency
        .with_label_values(&["images"])
        .observe(start_instant.elapsed().as_secs_f64());
    Ok((axum::http::StatusCode::OK, Json(response_json)).into_response())
}
