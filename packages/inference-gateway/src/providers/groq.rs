//! Groq API relay provider.
//!
//! Groq operates an OpenAI-compatible inference endpoint at
//! `https://api.groq.com/openai/v1`. When the Wattz node pool has no
//! healthy node for a model, or when the request targets a model that
//! Groq serves with very low latency (Llama 3.1 8B instant, Llama 3.3
//! 70B versatile, GPT-OSS), the gateway relays the request to Groq and
//! stamps the response with Wattz metadata so the caller sees the same
//! shape as a native node response. Relayed responses are always marked
//! `verified: false` / kind `relay` -- the gateway never claims TEE
//! attestation for compute it did not verify.
//!
//! The Groq API key is read from the `GROQ_API_KEY` environment
//! variable at startup and never leaves the process address space --
//! it is a server-only secret with no frontend-exposed counterpart.

use crate::error::ApiError;
use axum::response::sse::{Event, KeepAlive, Sse};
use bytes::Bytes;
use eventsource_stream::Eventsource;
use futures::stream::{Stream, StreamExt};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::{Client, Method};
use serde::Serialize;
use serde_json::Value;
use std::convert::Infallible;
use std::time::Duration;

/// Region label surfaced on responses that flow through Groq. Groq
/// primary datacenter is us-east; this label is what the Wattz UI
/// renders in the node metadata badge.
pub const GROQ_REGION: &str = "us-east";

/// Placeholder public key stamped as the "node" for Groq-relayed
/// responses. Distinctive on purpose so downstream tooling can tell
/// the difference between a native Wattz node and a Groq relay leg.
pub const GROQ_NODE_PUBKEY: &str = "GroqUsEast11111111111111111111111111111111";

/// Label emitted for Groq-relayed responses (`x-wattz-attestation`
/// header and the `wattz.attestation.kind` field). Relayed traffic
/// carries no TEE quote the gateway can verify, so it is never labelled
/// as attested -- just `relay`.
pub const GROQ_RELAY_LABEL: &str = "relay";

/// Approximate Groq pricing translated to lamports per 1k output
/// tokens. Public Groq pricing is ~$0.05-$0.60 per 1M output tokens
/// depending on the model tier; this is a small-model tier used for
/// settlement math only (Anchor receipts still record the number).
pub const GROQ_PRICE_PER_1K_LAMPORTS: u64 = 120;

/// Reputation score reported for the Groq relay leg. Anchored high
/// because Groq is a first-party provider with consistent uptime; this
/// is an operational score, not a trust attestation.
pub const GROQ_REPUTATION: f64 = 0.95;

/// Advertised round-trip latency for Groq. Real measurements come from
/// the response, but the routing engine wants a number at pick time.
pub const GROQ_LATENCY_MS: u64 = 40;

/// Default Groq base URL. Overridable via `GROQ_BASE_URL`.
pub const DEFAULT_GROQ_BASE_URL: &str = "https://api.groq.com/openai/v1";

/// Which Wattz standard model names the gateway prefers to serve via
/// Groq even when a local node advertises the same id. Groq inference
/// is 10x lower latency than any currently registered Wattz node for
/// these small / mid open-weights models. Only ids Groq actively serves
/// for chat belong here -- retired Groq models (Mixtral, Gemma 2) and
/// non-chat models (Whisper) must not be advertised as relay-routable.
const GROQ_PREFERRED_MODELS: &[&str] = &[
    "gpt-oss",
    "gpt-oss-20b",
    "llama-3-8b",
    "llama-3.1-8b-instant",
    "llama-3-70b",
    "llama-3.3-70b-versatile",
    "llama-3.1-70b",
];

/// Map a Wattz standard model name to the exact model id Groq expects.
/// Unknown ids are passed through verbatim so callers that already
/// supply a Groq-native id keep working.
pub fn map_model(model: &str) -> String {
    match model {
        "llama-3-8b" | "llama-3.1-8b" | "llama-3.1-8b-instant" => {
            "llama-3.1-8b-instant".to_string()
        }
        "llama-3-70b" | "llama-3.1-70b" | "llama-3.3-70b-versatile" => {
            "llama-3.3-70b-versatile".to_string()
        }
        "gpt-oss" | "gpt-oss-20b" => "openai/gpt-oss-20b".to_string(),
        other => other.to_string(),
    }
}

/// Whether the gateway routes `model` to Groq by preference even when
/// a Wattz node also advertises it.
pub fn is_preferred(model: &str) -> bool {
    GROQ_PREFERRED_MODELS.iter().any(|m| *m == model)
}

/// Whether Groq can serve `model` at all (used as the fallback
/// admission check when the node pool is empty). Same set as
/// [`is_preferred`] for now.
pub fn can_serve(model: &str) -> bool {
    is_preferred(model)
}

/// Metadata describing a Groq-served request. Shape mirrors
/// [`crate::routing::NodeSelection`] so the request handler can render
/// a Wattz metadata block identical to the one it renders for a native
/// node.
#[derive(Clone, Debug, Serialize)]
pub struct GroqSelection {
    pub original_model: String,
    pub groq_model: String,
    pub node_pubkey: String,
    pub region: String,
    pub price_per_1k_lamports: u64,
    pub reputation: f64,
    pub latency_ms: u64,
    /// Always [`GROQ_RELAY_LABEL`]. Relayed traffic is unverified.
    pub relay_label: String,
}

impl GroqSelection {
    pub fn new(original_model: &str) -> Self {
        Self {
            original_model: original_model.to_string(),
            groq_model: map_model(original_model),
            node_pubkey: GROQ_NODE_PUBKEY.to_string(),
            region: GROQ_REGION.to_string(),
            price_per_1k_lamports: GROQ_PRICE_PER_1K_LAMPORTS,
            reputation: GROQ_REPUTATION,
            latency_ms: GROQ_LATENCY_MS,
            relay_label: GROQ_RELAY_LABEL.to_string(),
        }
    }
}

/// HTTP client that speaks Groq's OpenAI-compatible API. Cloned via
/// `Arc` in [`crate::state::AppState`].
pub struct GroqProvider {
    client: Client,
    api_key: String,
    base_url: String,
}

impl GroqProvider {
    pub fn new(api_key: String, base_url: String, upstream_timeout: Duration) -> Self {
        let base_url = base_url.trim_end_matches('/').to_string();
        let client = Client::builder()
            .timeout(upstream_timeout)
            .user_agent(concat!(
                "wattz-inference-gateway/",
                env!("CARGO_PKG_VERSION")
            ))
            .pool_max_idle_per_host(64)
            .build()
            .expect("reqwest client");
        Self {
            client,
            api_key,
            base_url,
        }
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    /// Non-streaming JSON forward. Substitutes the mapped model id into
    /// the outgoing body and normalises the returned `model` field back
    /// to the caller's original id.
    pub async fn forward_chat_json(
        &self,
        selection: &GroqSelection,
        request_id: &str,
        body: &Value,
    ) -> Result<Value, ApiError> {
        let url = format!("{}/chat/completions", self.base_url);
        let payload = rewrite_payload(body, &selection.groq_model, false);
        let resp = self
            .client
            .request(Method::POST, url)
            .headers(self.base_headers(request_id))
            .json(&payload)
            .send()
            .await
            .map_err(|e| ApiError::Upstream(format!("groq connect: {}", e)))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp
                .text()
                .await
                .unwrap_or_else(|_| "<no body>".into());
            return Err(ApiError::Upstream(format!(
                "groq returned {}: {}",
                status, text
            )));
        }
        let mut json = resp
            .json::<Value>()
            .await
            .map_err(|e| ApiError::Upstream(format!("groq json decode: {}", e)))?;
        if let Value::Object(map) = &mut json {
            map.insert(
                "model".into(),
                Value::String(selection.original_model.clone()),
            );
        }
        Ok(json)
    }

    /// Streaming SSE forward. Relays chunks byte-for-byte from Groq.
    /// The Wattz metadata / node headers are stamped by the caller on
    /// the outer `Response` after this returns.
    pub async fn forward_chat_sse(
        &self,
        selection: &GroqSelection,
        request_id: &str,
        body: &Value,
    ) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, ApiError> {
        let url = format!("{}/chat/completions", self.base_url);
        let payload = rewrite_payload(body, &selection.groq_model, true);
        let mut headers = self.base_headers(request_id);
        headers.insert(
            reqwest::header::ACCEPT,
            HeaderValue::from_static("text/event-stream"),
        );

        let resp = self
            .client
            .request(Method::POST, url)
            .headers(headers)
            .json(&payload)
            .send()
            .await
            .map_err(|e| ApiError::Upstream(format!("groq sse connect: {}", e)))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_else(|_| "<no body>".into());
            return Err(ApiError::Upstream(format!(
                "groq sse returned {}: {}",
                status, text
            )));
        }

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
                        let ev = Event::default().data(event.data);
                        yield Ok::<_, Infallible>(ev);
                    }
                    Err(e) => {
                        let err_body = serde_json::json!({
                            "error": {
                                "message": format!("groq sse error: {}", e),
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

    fn base_headers(&self, request_id: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        if let Ok(v) = HeaderValue::from_str(&format!("Bearer {}", self.api_key)) {
            headers.insert(reqwest::header::AUTHORIZATION, v);
        }
        headers.insert(
            reqwest::header::CONTENT_TYPE,
            HeaderValue::from_static("application/json"),
        );
        if let Ok(name) = HeaderName::from_bytes(b"x-wattz-request-id") {
            if let Ok(v) = HeaderValue::from_str(request_id) {
                headers.insert(name, v);
            }
        }
        headers
    }
}

/// Clone the incoming OpenAI payload and rewrite `model` / `stream` to
/// the values expected by Groq. Also strips fields Groq does not
/// accept (Wattz-specific routing hints have already been stripped by
/// `ChatCompletionRequest::strip_wattz_extensions` upstream, so this
/// only guarantees the model id and stream flag).
fn rewrite_payload(body: &Value, groq_model: &str, stream: bool) -> Value {
    let mut payload = body.clone();
    if let Value::Object(map) = &mut payload {
        map.insert("model".into(), Value::String(groq_model.to_string()));
        map.insert("stream".into(), Value::Bool(stream));
    }
    payload
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_wattz_ids_to_groq_ids() {
        assert_eq!(map_model("llama-3-8b"), "llama-3.1-8b-instant");
        assert_eq!(map_model("llama-3-70b"), "llama-3.3-70b-versatile");
        assert_eq!(map_model("gpt-oss"), "openai/gpt-oss-20b");
        assert_eq!(map_model("gpt-oss-20b"), "openai/gpt-oss-20b");
    }

    #[test]
    fn passes_through_unknown_ids() {
        assert_eq!(map_model("custom-model-42"), "custom-model-42");
        assert_eq!(
            map_model("llama-3.3-70b-versatile"),
            "llama-3.3-70b-versatile"
        );
    }

    #[test]
    fn preferred_set_covers_groq_headline_models() {
        assert!(is_preferred("llama-3-8b"));
        assert!(is_preferred("llama-3.1-8b-instant"));
        assert!(is_preferred("llama-3.3-70b-versatile"));
        assert!(is_preferred("gpt-oss-20b"));
        assert!(!is_preferred("stable-diffusion-xl-1.0"));
        // gpt-oss-120b is not in the advertised /v1/models catalog and
        // maps to no catalog id, so it must not be relay-preferred.
        assert!(!is_preferred("gpt-oss-120b"));
        assert!(!can_serve("gpt-oss-120b"));
    }

    #[test]
    fn retired_and_non_chat_models_are_not_routable() {
        for id in [
            "mixtral-8x7b",
            "mixtral-8x7b-32768",
            "gemma-2-9b",
            "gemma2-9b-it",
            "mistral-7b",
            "mistral-7b-instruct-v0.3",
            "whisper-large-v3",
            "whisper-large-v3-turbo",
        ] {
            assert!(!is_preferred(id), "{} must not be relay-preferred", id);
            assert!(!can_serve(id), "{} must not be relay-servable", id);
        }
    }

    #[test]
    fn relay_selection_carries_honest_label() {
        let sel = GroqSelection::new("llama-3-8b");
        assert_eq!(sel.relay_label, GROQ_RELAY_LABEL);
        assert_eq!(GROQ_RELAY_LABEL, "relay");
    }

    #[test]
    fn rewrite_payload_forces_model_and_stream() {
        let body = serde_json::json!({
            "model": "llama-3-8b",
            "messages": [{"role":"user","content":"hi"}],
            "stream": false
        });
        let out = rewrite_payload(&body, "llama-3.1-8b-instant", true);
        assert_eq!(out["model"], "llama-3.1-8b-instant");
        assert_eq!(out["stream"], true);
        assert_eq!(out["messages"][0]["role"], "user");
    }
}
