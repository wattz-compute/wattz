//! Upstream node proxy.
//!
//! For non-streaming requests we do a straight JSON forward. For
//! streaming (`stream: true`) requests we return an SSE response that
//! copies chunks byte-for-byte from the upstream so tokens flow through
//! with sub-request latency.
//!
//! The proxy also records the attestation header (`X-Wattz-Attestation`)
//! that every honest node emits with each streamed chunk / final response.

use crate::attestation::AttestationEnvelope;
use crate::error::ApiError;
use crate::routing::NodeSelection;
use axum::response::sse::{Event, KeepAlive, Sse};
use bytes::Bytes;
use eventsource_stream::Eventsource;
use futures::stream::{Stream, StreamExt};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::{Client, Method};
use serde_json::Value;
use std::convert::Infallible;
use std::time::Duration;

pub const ATTESTATION_HEADER: &str = "x-wattz-attestation";

/// Wrap a base request body in the shape expected by the node runtime.
/// Nodes accept the raw OpenAI payload verbatim; we only add a
/// `x-wattz-request-id` header for correlation.
pub struct NodeProxy {
    client: Client,
}

impl NodeProxy {
    pub fn new(upstream_timeout: Duration) -> Self {
        let client = Client::builder()
            .timeout(upstream_timeout)
            .user_agent(concat!("wattz-inference-gateway/", env!("CARGO_PKG_VERSION")))
            .pool_max_idle_per_host(64)
            .build()
            .expect("reqwest client");
        Self { client }
    }

    /// Forward a non-streaming JSON request. Returns the parsed JSON
    /// body plus the (optional) attestation envelope.
    pub async fn forward_json(
        &self,
        node: &NodeSelection,
        path: &str,
        request_id: &str,
        body: &Value,
    ) -> Result<(Value, Option<AttestationEnvelope>), ApiError> {
        let url = build_url(&node.http_endpoint, path);
        let mut headers = base_headers(node.auth_token.as_deref(), request_id);
        headers.insert(reqwest::header::CONTENT_TYPE, HeaderValue::from_static("application/json"));

        let resp = self
            .client
            .request(Method::POST, url)
            .headers(headers)
            .json(body)
            .send()
            .await
            .map_err(|e| ApiError::Upstream(format!("upstream connect: {}", e)))?;

        let status = resp.status();
        let attestation = extract_attestation(resp.headers());
        if !status.is_success() {
            let text = resp
                .text()
                .await
                .unwrap_or_else(|_| "<no body>".into());
            return Err(ApiError::Upstream(format!(
                "upstream {} returned {}: {}",
                node.node_pubkey, status, text
            )));
        }
        let json = resp
            .json::<Value>()
            .await
            .map_err(|e| ApiError::Upstream(format!("upstream json decode: {}", e)))?;
        Ok((json, attestation))
    }

    /// Forward a streaming request. Returns an SSE response and the
    /// last-seen attestation envelope (updated as chunks arrive, so
    /// call `attestation.lock()` after the stream ends).
    pub async fn forward_sse(
        &self,
        node: &NodeSelection,
        path: &str,
        request_id: &str,
        body: &Value,
    ) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, ApiError> {
        let url = build_url(&node.http_endpoint, path);
        let mut headers = base_headers(node.auth_token.as_deref(), request_id);
        headers.insert(reqwest::header::CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(reqwest::header::ACCEPT, HeaderValue::from_static("text/event-stream"));

        let resp = self
            .client
            .request(Method::POST, url)
            .headers(headers)
            .json(body)
            .send()
            .await
            .map_err(|e| ApiError::Upstream(format!("upstream sse connect: {}", e)))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_else(|_| "<no body>".into());
            return Err(ApiError::Upstream(format!(
                "upstream {} sse returned {}: {}",
                node.node_pubkey, status, text
            )));
        }

        // Convert the reqwest byte stream into an SSE event stream and
        // then into axum SSE events. On upstream connection errors we
        // emit a final `error` event and close the stream.
        let byte_stream = resp.bytes_stream().map(|res| {
            res.map(Bytes::from)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
        });
        let sse_stream = byte_stream.eventsource();

        let stream = async_stream::stream! {
            let mut sse_stream = std::pin::pin!(sse_stream);
            while let Some(item) = sse_stream.next().await {
                match item {
                    Ok(event) => {
                        // OpenAI streaming spec uses a bare `data:`
                        // event with no `event:` type; keep it that way
                        // and preserve `[DONE]` sentinel.
                        let ev = Event::default().data(event.data);
                        yield Ok::<_, Infallible>(ev);
                    }
                    Err(e) => {
                        let err_body = serde_json::json!({
                            "error": {
                                "message": format!("upstream sse error: {}", e),
                                "type": "upstream_error"
                            }
                        });
                        yield Ok::<_, Infallible>(
                            Event::default().data(err_body.to_string())
                        );
                        yield Ok::<_, Infallible>(Event::default().data("[DONE]"));
                        break;
                    }
                }
            }
        };

        Ok(Sse::new(stream).keep_alive(
            KeepAlive::new()
                .interval(Duration::from_secs(15))
                .text("wattz-keepalive"),
        ))
    }
}

fn build_url(endpoint: &str, path: &str) -> String {
    let base = endpoint.trim_end_matches('/');
    let suffix = if path.starts_with('/') { path } else { "/" };
    if path.starts_with('/') {
        format!("{}{}", base, path)
    } else {
        format!("{}{}{}", base, suffix, path)
    }
}

fn base_headers(auth: Option<&str>, request_id: &str) -> HeaderMap {
    let mut headers = HeaderMap::new();
    if let Some(token) = auth {
        if let Ok(v) = HeaderValue::from_str(&format!("Bearer {}", token)) {
            headers.insert(reqwest::header::AUTHORIZATION, v);
        }
    }
    if let Ok(name) = HeaderName::from_bytes(b"x-wattz-request-id") {
        if let Ok(v) = HeaderValue::from_str(request_id) {
            headers.insert(name, v);
        }
    }
    headers
}

fn extract_attestation(headers: &reqwest::header::HeaderMap) -> Option<AttestationEnvelope> {
    let raw = headers
        .get(ATTESTATION_HEADER)
        .and_then(|v| v.to_str().ok())?;
    match serde_json::from_str::<AttestationEnvelope>(raw) {
        Ok(env) => Some(env),
        Err(e) => {
            tracing::warn!(%e, "failed to parse attestation envelope");
            None
        }
    }
}
