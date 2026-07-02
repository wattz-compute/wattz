//! `/v1/chat/completions` -- OpenAI-compatible chat endpoint with both
//! streaming and non-streaming responses.
//!
//! The handler:
//!
//! 1. Deserializes the OpenAI request.
//! 2. Consults the Model Registry cache for licensing / KYC.
//! 3. Asks the routing engine for the best target (native Wattz node
//!    or Groq fallback provider).
//! 4. Forwards the request via [`crate::proxy::NodeProxy`] or the
//!    [`crate::providers::GroqProvider`], depending on the target.
//! 5. Verifies the returned attestation envelope (native nodes only).
//! 6. Packs an [`crate::settlement::InferenceReceipt`] and submits it
//!    to the Anchor program (simulated when no keypair is set).
//! 7. Returns the response with a `wattz` metadata block and Wattz
//!    node/region/attestation headers.

use axum::{
    extract::State,
    http::{HeaderMap, HeaderName, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use serde_json::{json, Value};

use crate::error::{ApiError, ApiResult};
use crate::openai::types::ChatCompletionRequest;
use crate::providers::GroqSelection;
use crate::routing::{NodeSelection, RoutedTarget};
use crate::settlement::InferenceReceipt;
use crate::state::AppState;

const HEADER_WATTZ_NODE: HeaderName = HeaderName::from_static("x-wattz-node");
const HEADER_WATTZ_REGION: HeaderName = HeaderName::from_static("x-wattz-region");
const HEADER_WATTZ_ATTESTATION: HeaderName = HeaderName::from_static("x-wattz-attestation");
const HEADER_WATTZ_REQUEST_ID: HeaderName = HeaderName::from_static("x-wattz-request-id");

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

    // Model Registry lookup. This ONLY enforces KYC for commercial-
    // licensed catalog models; it does not reject unknown ids. Ids absent
    // from the catalog (including documented Groq aliases like
    // `llama-3-8b`) fall through to routing, which serves them when a
    // node or the Groq relay can and otherwise returns `NoNodeAvailable`.
    let model_entry = state.model_by_id(&req.model);
    if let Some(entry) = &model_entry {
        if entry.kyc_required && req.wattz_kyc_token.is_none() && kyc_header(&headers).is_none() {
            return Err(ApiError::BadRequest(format!(
                "model {} requires KYC (license {})",
                entry.model_id, entry.license
            )));
        }
    }

    // Lifetime request counter surfaced by `/v1/network/stats`. Counts
    // every well-formed inference request the gateway attempts to route.
    state
        .requests_total
        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);

    // Routing (Groq-aware). When the operator has configured
    // `GROQ_API_KEY`, requests for Groq-preferred models are routed
    // straight to Groq, and any model the node pool cannot serve falls
    // through to Groq as a last-resort provider.
    let target = state.routing.pick_with_groq(
        &req.model,
        req.wattz_region.as_deref(),
        req.wattz_min_reputation.unwrap_or(0.0),
        state.groq.is_some(),
    )?;

    let request_id = uuid::Uuid::new_v4();
    let request_id_str = request_id.to_string();
    let stream = req.stream;
    let upstream_body =
        serde_json::to_value(req.clone().strip_wattz_extensions()).map_err(ApiError::Json)?;
    let started_at = Utc::now();

    match target {
        RoutedTarget::Node(selection) => {
            handle_node(
                state,
                selection,
                upstream_body,
                request_id,
                request_id_str,
                stream,
                &req,
                started_at,
                start,
            )
            .await
        }
        RoutedTarget::Groq(selection) => {
            handle_groq(
                state,
                selection,
                upstream_body,
                request_id,
                request_id_str,
                stream,
                &req,
                started_at,
                start,
            )
            .await
        }
    }
}

#[allow(clippy::too_many_arguments)]
async fn handle_node(
    state: AppState,
    selection: NodeSelection,
    upstream_body: Value,
    request_id: uuid::Uuid,
    request_id_str: String,
    stream: bool,
    req: &ChatCompletionRequest,
    started_at: chrono::DateTime<Utc>,
    start: std::time::Instant,
) -> ApiResult<Response> {
    tracing::info!(
        node = %selection.node_pubkey,
        endpoint = %selection.http_endpoint,
        model = %req.model,
        stream = stream,
        "chat request routed to wattz node"
    );

    if stream {
        // Streaming path. We do not attempt attestation verification /
        // settlement here because the response arrives incrementally.
        // The node runtime is contracted to submit the settlement
        // itself for streamed replies (streaming payment covers each
        // checkpoint). The gateway records the request in metrics and
        // stamps the Wattz metadata headers on the outer response.
        let sse = state
            .proxy
            .forward_sse(
                &selection,
                "/v1/chat/completions",
                &request_id_str,
                &upstream_body,
            )
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
        let mut response = sse.into_response();
        apply_node_headers(response.headers_mut(), &selection, &request_id_str);
        return Ok(response);
    }

    // Non-streaming path.
    let (mut response_json, attestation_envelope) = state
        .proxy
        .forward_json(
            &selection,
            "/v1/chat/completions",
            &request_id_str,
            &upstream_body,
        )
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
    let price_lamports =
        compute_price_lamports(selection.price_per_1k_lamports, input_tokens, output_tokens);

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
        "provider": "wattz-node",
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

    let mut response = (StatusCode::OK, Json(response_json)).into_response();
    apply_node_headers(response.headers_mut(), &selection, &request_id_str);
    Ok(response)
}

#[allow(clippy::too_many_arguments)]
async fn handle_groq(
    state: AppState,
    selection: GroqSelection,
    upstream_body: Value,
    request_id: uuid::Uuid,
    request_id_str: String,
    stream: bool,
    req: &ChatCompletionRequest,
    started_at: chrono::DateTime<Utc>,
    start: std::time::Instant,
) -> ApiResult<Response> {
    tracing::info!(
        provider = "groq",
        original_model = %req.model,
        groq_model = %selection.groq_model,
        stream = stream,
        "chat request routed to groq fallback"
    );
    let groq = state
        .groq
        .as_ref()
        .ok_or_else(|| ApiError::Internal("groq route selected but provider missing".into()))?;

    if stream {
        let sse = groq
            .forward_chat_sse(&selection, &request_id_str, &upstream_body)
            .await?;
        state
            .metrics
            .requests_total
            .with_label_values(&["chat_groq", "stream_ok"])
            .inc();
        state
            .metrics
            .request_latency
            .with_label_values(&["chat_stream_groq"])
            .observe(start.elapsed().as_secs_f64());
        let mut response = sse.into_response();
        apply_groq_headers(response.headers_mut(), &selection, &request_id_str);
        return Ok(response);
    }

    let mut response_json = groq
        .forward_chat_json(&selection, &request_id_str, &upstream_body)
        .await?;

    let (input_tokens, output_tokens) = extract_usage(&response_json);
    let price_lamports =
        compute_price_lamports(selection.price_per_1k_lamports, input_tokens, output_tokens);

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
        attestation: None,
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
            tracing::warn!(error = %e, "groq settlement submission failed (non-fatal)");
            state
                .metrics
                .settlement_total
                .with_label_values(&["failed"])
                .inc();
            None
        }
    };

    let wattz_meta = json!({
        "request_id": request_id_str,
        "provider": "groq",
        "node": {
            "pubkey": selection.node_pubkey,
            "region": selection.region,
            "price_per_1k_lamports": selection.price_per_1k_lamports,
            "reputation": selection.reputation,
            "latency_ms": selection.latency_ms,
            "is_bootstrap_fallback": true,
        },
        "attestation": {
            "verified": false,
            "kind": "relay",
        },
        "settlement": settlement_summary,
        "price_lamports": price_lamports,
        "groq_model": selection.groq_model,
    });
    if let Value::Object(map) = &mut response_json {
        map.insert("wattz".into(), wattz_meta);
    }

    state
        .metrics
        .requests_total
        .with_label_values(&["chat_groq", "ok"])
        .inc();
    state
        .metrics
        .request_latency
        .with_label_values(&["chat_groq"])
        .observe(start.elapsed().as_secs_f64());

    let mut response = (StatusCode::OK, Json(response_json)).into_response();
    apply_groq_headers(response.headers_mut(), &selection, &request_id_str);
    Ok(response)
}

fn apply_node_headers(headers: &mut HeaderMap, selection: &NodeSelection, request_id: &str) {
    if let Ok(v) = HeaderValue::from_str(&selection.node_pubkey) {
        headers.insert(HEADER_WATTZ_NODE, v);
    }
    if let Ok(v) = HeaderValue::from_str(&selection.region) {
        headers.insert(HEADER_WATTZ_REGION, v);
    }
    if let Ok(v) = HeaderValue::from_str(request_id) {
        headers.insert(HEADER_WATTZ_REQUEST_ID, v);
    }
}

fn apply_groq_headers(headers: &mut HeaderMap, selection: &GroqSelection, request_id: &str) {
    if let Ok(v) = HeaderValue::from_str(&selection.node_pubkey) {
        headers.insert(HEADER_WATTZ_NODE, v);
    }
    if let Ok(v) = HeaderValue::from_str(&selection.region) {
        headers.insert(HEADER_WATTZ_REGION, v);
    }
    if let Ok(v) = HeaderValue::from_str(&selection.relay_label) {
        headers.insert(HEADER_WATTZ_ATTESTATION, v);
    }
    if let Ok(v) = HeaderValue::from_str(request_id) {
        headers.insert(HEADER_WATTZ_REQUEST_ID, v);
    }
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
