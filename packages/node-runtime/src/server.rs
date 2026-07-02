//! axum HTTP surface exposed by the node runtime.
//!
//! Endpoints:
//!
//! - `GET /healthz` -- liveness probe.
//! - `GET /readyz` -- ready when the backend is reachable.
//! - `GET /v1/models` -- OpenAI-compatible model catalog (merges
//!   backend-detected models with the configured registry).
//! - `POST /v1/chat/completions` -- OpenAI-compatible chat with SSE
//!   streaming and a signed attestation envelope in a trailing header.
//! - `POST /v1/embeddings` -- OpenAI-compatible embeddings.
//!
//! Every response includes an `x-wattz-attestation` header populated with
//! the base64 encoding of the `AttestationEnvelope` JSON.

use crate::attestation::AttestationEnvelope;
use crate::inference::{ChatRequest, EmbeddingsRequest};
use crate::state::NodeState;
use axum::body::Body;
use axum::extract::State;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use base64::Engine;
use futures::StreamExt;
use serde::Serialize;

pub async fn healthz() -> impl IntoResponse {
    (StatusCode::OK, "ok")
}

pub async fn readyz(State(state): State<NodeState>) -> impl IntoResponse {
    match state.backend.list_models().await {
        Ok(_) => (StatusCode::OK, "ready"),
        Err(err) => {
            tracing::warn!(?err, "backend unreachable");
            (StatusCode::SERVICE_UNAVAILABLE, "backend unreachable")
        }
    }
}

#[derive(Serialize)]
struct ModelListItem {
    id: String,
    object: &'static str,
    owned_by: String,
    price_per_1k_input_tokens: f64,
    price_per_1k_output_tokens: f64,
    context_window: u32,
    license: String,
    kyc_required: bool,
}

#[derive(Serialize)]
struct ModelList {
    object: &'static str,
    data: Vec<ModelListItem>,
}

pub async fn list_models(State(state): State<NodeState>) -> impl IntoResponse {
    let mut data: Vec<ModelListItem> = state
        .config
        .models
        .iter()
        .map(|m| ModelListItem {
            id: m.name.clone(),
            object: "model",
            owned_by: state.config.node_id.clone(),
            price_per_1k_input_tokens: m.price_per_1k_input_tokens,
            price_per_1k_output_tokens: m.price_per_1k_output_tokens,
            context_window: m.context_window,
            license: m.license.clone(),
            kyc_required: m.kyc_required,
        })
        .collect();
    // Merge any additional models the backend has that the operator did
    // not enumerate in the config.
    if let Ok(loaded) = state.backend.list_models().await {
        for name in loaded {
            if !data.iter().any(|d| d.id == name) {
                data.push(ModelListItem {
                    id: name,
                    object: "model",
                    owned_by: state.config.node_id.clone(),
                    price_per_1k_input_tokens: 0.0,
                    price_per_1k_output_tokens: 0.0,
                    context_window: 0,
                    license: "unspecified".into(),
                    kyc_required: false,
                });
            }
        }
    }
    Json(ModelList {
        object: "list",
        data,
    })
}

pub async fn chat_completions(
    State(state): State<NodeState>,
    Json(req): Json<ChatRequest>,
) -> Response {
    state.metrics.inc_requests();

    if req.stream {
        match state.backend.chat_completion_stream(&req).await {
            Ok(stream) => {
                let nonce = generate_nonce();
                let model = req.model.clone();
                // Wrap the SSE stream. On completion, compute the digest
                // over the full body and emit a final `data:` event with
                // the attestation envelope.
                let signer = state.signer.clone();
                let metrics = state.metrics.clone();

                let sse = async_stream::stream! {
                    let mut collected = Vec::new();
                    let mut token_count = 0u32;
                    futures::pin_mut!(stream);
                    while let Some(chunk) = stream.next().await {
                        match chunk {
                            Ok(bytes) => {
                                token_count = token_count.saturating_add(count_openai_delta_tokens(&bytes));
                                collected.extend_from_slice(&bytes);
                                yield Ok::<_, std::io::Error>(bytes);
                            }
                            Err(err) => {
                                tracing::warn!(?err, "backend stream chunk failed");
                                let payload = format!("event: error\ndata: {}\n\n", err);
                                yield Ok(bytes::Bytes::from(payload));
                                break;
                            }
                        }
                    }
                    let env = signer.sign_response(&collected, nonce, &model, token_count, None);
                    let ser = serde_json::to_string(&env).unwrap_or_default();
                    let final_event = format!("event: wattz-attestation\ndata: {}\n\n", ser);
                    yield Ok(bytes::Bytes::from(final_event));
                    metrics.inc_completed();
                };

                let body = Body::from_stream(sse);
                let mut headers = HeaderMap::new();
                headers.insert(
                    header::CONTENT_TYPE,
                    HeaderValue::from_static("text/event-stream"),
                );
                headers.insert(
                    HeaderValue::from_static("x-wattz-node")
                        .to_str()
                        .map(|_| header::HeaderName::from_static("x-wattz-node"))
                        .unwrap(),
                    HeaderValue::from_str(&state.config.node_id)
                        .unwrap_or(HeaderValue::from_static("unknown")),
                );
                (StatusCode::OK, headers, body).into_response()
            }
            Err(err) => backend_error(err),
        }
    } else {
        match state.backend.chat_completion(&req).await {
            Ok(resp) => {
                let body = serde_json::to_vec(&resp).unwrap();
                let env = state.signer.sign_response(
                    &body,
                    generate_nonce(),
                    &req.model,
                    resp.usage.total_tokens,
                    None,
                );
                state.metrics.inc_completed();
                success(body, env, &state.config.node_id)
            }
            Err(err) => backend_error(err),
        }
    }
}

pub async fn embeddings(
    State(state): State<NodeState>,
    Json(req): Json<EmbeddingsRequest>,
) -> Response {
    state.metrics.inc_requests();
    match state.backend.embeddings(&req).await {
        Ok(resp) => {
            let body = serde_json::to_vec(&resp).unwrap();
            let env = state.signer.sign_response(
                &body,
                generate_nonce(),
                &req.model,
                resp.usage.total_tokens,
                None,
            );
            state.metrics.inc_completed();
            success(body, env, &state.config.node_id)
        }
        Err(err) => backend_error(err),
    }
}

fn success(body: Vec<u8>, env: AttestationEnvelope, node_id: &str) -> Response {
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/json"),
    );
    let env_json = serde_json::to_string(&env).unwrap();
    let env_b64 = base64::engine::general_purpose::STANDARD.encode(env_json.as_bytes());
    headers.insert(
        axum::http::HeaderName::from_static("x-wattz-attestation"),
        HeaderValue::from_str(&env_b64).unwrap_or(HeaderValue::from_static("")),
    );
    headers.insert(
        axum::http::HeaderName::from_static("x-wattz-node"),
        HeaderValue::from_str(node_id).unwrap_or(HeaderValue::from_static("unknown")),
    );
    (StatusCode::OK, headers, body).into_response()
}

fn backend_error(err: anyhow::Error) -> Response {
    tracing::warn!(?err, "backend error");
    let body = serde_json::json!({
        "error": {
            "type": "backend_error",
            "message": err.to_string(),
        }
    });
    (StatusCode::BAD_GATEWAY, Json(body)).into_response()
}

fn generate_nonce() -> [u8; 32] {
    use rand::RngCore;
    let mut nonce = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut nonce);
    nonce
}

/// Best-effort token counter for OpenAI-format SSE deltas. Counts each
/// SSE frame whose `delta.content` is a non-empty string as one token.
/// This is only used for the on-the-fly attestation envelope; the
/// authoritative usage is what the backend reports in its final chunk.
fn count_openai_delta_tokens(chunk: &[u8]) -> u32 {
    let s = match std::str::from_utf8(chunk) {
        Ok(s) => s,
        Err(_) => return 0,
    };
    let mut count = 0u32;
    for line in s.lines() {
        let Some(rest) = line.strip_prefix("data: ") else {
            continue;
        };
        if rest == "[DONE]" {
            continue;
        }
        let Ok(v) = serde_json::from_str::<serde_json::Value>(rest) else {
            continue;
        };
        let Some(choices) = v.get("choices").and_then(|c| c.as_array()) else {
            continue;
        };
        for choice in choices {
            let content = choice
                .get("delta")
                .and_then(|d| d.get("content"))
                .and_then(|c| c.as_str())
                .unwrap_or("");
            if !content.is_empty() {
                count = count.saturating_add(1);
            }
        }
    }
    count
}
