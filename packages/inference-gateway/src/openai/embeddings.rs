//! `/v1/embeddings`.

use axum::{
    extract::State,
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use serde_json::{json, Value};

use crate::error::{ApiError, ApiResult};
use crate::openai::types::EmbeddingsRequest;
use crate::settlement::InferenceReceipt;
use crate::state::AppState;

pub async fn create_embeddings(
    State(state): State<AppState>,
    Json(req): Json<EmbeddingsRequest>,
) -> ApiResult<Response> {
    let started_at = Utc::now();
    let start_instant = std::time::Instant::now();
    if req.model.is_empty() {
        return Err(ApiError::BadRequest("model is required".into()));
    }
    // Estimate token count from string / array input for pricing.
    let approx_input_tokens = estimate_tokens(&req.input);

    let selection = state
        .routing
        .pick(&req.model, req.wattz_region.as_deref(), 0.0)?;
    let request_id = uuid::Uuid::new_v4();
    let request_id_str = request_id.to_string();

    let upstream_body = serde_json::to_value(req.clone().strip_wattz_extensions())?;
    let (mut response_json, attestation_envelope) = state
        .proxy
        .forward_json(&selection, "/v1/embeddings", &request_id_str, &upstream_body)
        .await?;

    let attestation_outcome = match attestation_envelope.as_ref() {
        Some(env) => Some(crate::attestation::verify(env)?),
        None => None,
    };

    let price_lamports = (selection.price_per_1k_lamports as u128 * approx_input_tokens as u128
        / 1000)
        .min(u128::from(u64::MAX)) as u64;

    let receipt = InferenceReceipt {
        request_id,
        model_id: req.model.clone(),
        input_tokens: approx_input_tokens,
        output_tokens: 0,
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
            }),
        );
    }
    state
        .metrics
        .requests_total
        .with_label_values(&["embeddings", "ok"])
        .inc();
    state
        .metrics
        .request_latency
        .with_label_values(&["embeddings"])
        .observe(start_instant.elapsed().as_secs_f64());
    Ok((axum::http::StatusCode::OK, Json(response_json)).into_response())
}

/// Heuristic: 1 token ~= 4 chars. Works for both string and array input.
fn estimate_tokens(input: &Value) -> u32 {
    fn count_chars(v: &Value) -> usize {
        match v {
            Value::String(s) => s.chars().count(),
            Value::Array(arr) => arr.iter().map(count_chars).sum(),
            _ => 0,
        }
    }
    let chars = count_chars(input);
    ((chars + 3) / 4).min(u32::MAX as usize) as u32
}
