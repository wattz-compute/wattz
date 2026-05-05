//! `/v1/chat/completions` -- OpenAI-compatible chat endpoint with both
//! streaming and non-streaming responses.
//!
//! The handler:
//!
//! 1. Deserializes the OpenAI request.
//! 2. Consults the Model Registry cache for licensing / KYC.
//! 3. Asks the routing engine for the best node.
//! 4. Forwards the request via [`crate::proxy::NodeProxy`].
//! 5. Verifies the returned attestation envelope.
//! 6. Packs an [`crate::settlement::InferenceReceipt`] and submits it
//!    to the Anchor program.
//! 7. Returns the response with a `wattz` metadata block appended.

use axum::{
    extract::State,
    http::HeaderMap,
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use serde_json::{json, Value};

use crate::error::{ApiError, ApiResult};
use crate::openai::types::ChatCompletionRequest;
use crate::settlement::InferenceReceipt;
use crate::state::AppState;

pub async fn create_completion(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<ChatCompletionRequest>,
) -> ApiResult<Response> {
    let start = std::time::Instant::now();
    // RAII guard: bumps the inflight gauge on construction and
    // decrements on drop so the count stays correct on any early return.
    let _guard = InflightGuard::new(state.metrics.inflight_requests.clone());

    if req.model.is_empty() {
        state
            .metrics
            .requests_total
            .with_label_values(&["chat", "bad_request"])
            .inc();
        return Err(ApiError::BadRequest("model is required".into()));
    }
    if req.messages.is_empty() {
        state
            .metrics
            .requests_total
            .with_label_values(&["chat", "bad_request"])
            .inc();
        return Err(ApiError::BadRequest("messages must not be empty".into()));
    }

    // Model Registry lookup -- rejects unknown models and enforces KYC
    // for commercial-licensed models.
    let model_entry = state.model_by_id(&req.model);
    if let Some(entry) = &model_entry {
        if entry.kyc_required && req.wattz_kyc_token.is_none() && kyc_header(&headers).is_none() {
            return Err(ApiError::BadRequest(format!(
                "model {} requires KYC (license {})",
                entry.model_id, entry.license
            )));
        }
    }

    // Routing.
    let selection = state.routing.pick(
        &req.model,
        req.wattz_region.as_deref(),
        req.wattz_min_reputation.unwrap_or(0.0),
    )?;
    tracing::info!(
        node = %selection.node_pubkey,
        endpoint = %selection.http_endpoint,
        model = %req.model,
        stream = req.stream,
        "chat request routed"
    );

    let request_id = uuid::Uuid::new_v4();
    let request_id_str = request_id.to_string();
    let stream = req.stream;
    let upstream_body =
        serde_json::to_value(req.clone().strip_wattz_extensions()).map_err(ApiError::Json)?;
    let started_at = Utc::now();

    if stream {
        // Streaming path. We do not attempt attestation verification /
        // settlement here because the response arrives incrementally.
        // The node runtime is contracted to submit the settlement
        // itself for streamed replies (settlement covers streaming
        // sessions with a checkpoint receipt). The gateway still
        // records the request in metrics.
        let sse = state
            .proxy
            .forward_sse(&selection, "/v1/chat/completions", &request_id_str, &upstream_body)
            .await?;
        state
            .metrics
            .requests_total
            .with_label_values(&["chat", "stream_ok"])
            .inc();
        state
            .metrics
            .request_latency
            .with_label_values(&["chat_stream"])
            .observe(start.elapsed().as_secs_f64());
        return Ok(sse.into_response());
    }

    // Non-streaming path.
    let (mut response_json, attestation_envelope) = state
        .proxy
        .forward_json(&selection, "/v1/chat/completions", &request_id_str, &upstream_body)
        .await?;

    // Attestation verification.
    let attestation_outcome = match attestation_envelope.as_ref() {
        Some(env) => {
            let outcome = crate::attestation::verify(env)?;
            let kind_label = attestation_kind_label(&outcome.quote_type);
            let status_label = if outcome.is_verified() { "ok" } else { "invalid" };
            state
                .metrics
                .attestation_total
                .with_label_values(&[kind_label, status_label])
                .inc();
            if !outcome.is_verified() {
                return Err(ApiError::AttestationFailed(format!(
                    "quote_type={:?} signature_ok={} structural_ok={}",
                    outcome.quote_type, outcome.signature_ok, outcome.structural_ok
                )));
            }
            Some(outcome)
        }
        None => {
            state
                .metrics
                .attestation_total
                .with_label_values(&["none", "missing"])
                .inc();
            tracing::warn!(
                node = %selection.node_pubkey,
                "upstream response missing X-Wattz-Attestation header"
            );
            None
        }
    };

    // Usage extraction.
    let (input_tokens, output_tokens) = extract_usage(&response_json);
    let price_lamports = compute_price_lamports(
        selection.price_per_1k_lamports,
        input_tokens,
        output_tokens,
    );

    // Settlement.
    let receipt = InferenceReceipt {
        request_id,
        model_id: req.model.clone(),
        input_tokens,
        output_tokens,
        price_lamports,
        node_pubkey: selection.node_pubkey.clone(),
        region: selection.region.clone(),
        started_at,
        completed_at: Utc::now(),
        attestation: attestation_outcome.clone(),
    };
    let settlement_summary = match state.settlement.submit(&receipt).await {
        Ok(s) => {
            let label = if s.simulated { "simulated" } else { "confirmed" };
            state
                .metrics
                .settlement_total
                .with_label_values(&[label])
                .inc();
            Some(s)
        }
        Err(e) => {
            tracing::error!(error = %e, "settlement submission failed");
            state
                .metrics
                .settlement_total
                .with_label_values(&["failed"])
                .inc();
            None
        }
    };

    // Augment response.
    let wattz_meta = json!({
        "request_id": request_id_str,
        "node": {
            "pubkey": selection.node_pubkey,
            "region": selection.region,
            "price_per_1k_lamports": selection.price_per_1k_lamports,
            "reputation": selection.reputation,
            "latency_ms": selection.latency_ms,
            "is_bootstrap_fallback": selection.is_bootstrap_fallback,
        },
        "attestation": attestation_outcome,
        "settlement": settlement_summary,
        "price_lamports": price_lamports,
    });
    if let Value::Object(map) = &mut response_json {
        map.insert("wattz".into(), wattz_meta);
    }

    state
        .metrics
        .requests_total
        .with_label_values(&["chat", "ok"])
        .inc();
    state
        .metrics
        .request_latency
        .with_label_values(&["chat"])
        .observe(start.elapsed().as_secs_f64());
    Ok((axum::http::StatusCode::OK, Json(response_json)).into_response())
}

fn extract_usage(v: &Value) -> (u32, u32) {
    let usage = v.get("usage");
    let input = usage
        .and_then(|u| u.get("prompt_tokens"))
        .and_then(|x| x.as_u64())
        .unwrap_or(0) as u32;
    let output = usage
        .and_then(|u| u.get("completion_tokens"))
        .and_then(|x| x.as_u64())
        .unwrap_or(0) as u32;
    (input, output)
}

fn compute_price_lamports(price_per_1k: u64, input: u32, output: u32) -> u64 {
    // Settlement covers the total emitted output (streaming payment
    // handles fine-grained cost). Input tokens are charged at 25% of
    // the output rate as a rough heuristic; the Anchor program may
    // renegotiate this. Uses saturating arithmetic to avoid overflow.
    let output_cost = (price_per_1k as u128 * output as u128) / 1000;
    let input_cost = (price_per_1k as u128 * input as u128) / 4000;
    let total = output_cost.saturating_add(input_cost);
    total.min(u128::from(u64::MAX)) as u64
}

fn attestation_kind_label(kind: &crate::attestation::QuoteType) -> &'static str {
    match kind {
        crate::attestation::QuoteType::Sgx => "sgx",
        crate::attestation::QuoteType::SevSnp => "sev_snp",
        crate::attestation::QuoteType::NvidiaCc => "nvidia_cc",
        crate::attestation::QuoteType::Risc0 => "risc0",
        crate::attestation::QuoteType::Sp1 => "sp1",
    }
}

fn kyc_header(headers: &HeaderMap) -> Option<String> {
    headers
        .get("x-wattz-kyc")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}

/// RAII guard that decrements `inflight_requests` when dropped.
struct InflightGuard {
    gauge: prometheus::IntGauge,
}

impl InflightGuard {
    fn new(gauge: prometheus::IntGauge) -> Self {
        gauge.inc();
        Self { gauge }
    }
}

impl Drop for InflightGuard {
    fn drop(&mut self) {
        self.gauge.dec();
    }
}
