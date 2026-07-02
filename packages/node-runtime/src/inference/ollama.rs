//! Ollama backend adapter.
//!
//! Ollama exposes both a native `/api/chat` endpoint and an
//! OpenAI-compatible `/v1/chat/completions` endpoint since 0.1.31. We
//! prefer the OpenAI-compatible surface because it lets us pass the
//! caller's schema through unchanged and inherit any new fields that
//! upstream OpenAI adds without changes here.

use super::*;
use anyhow::{anyhow, Context};
use async_stream::try_stream;
use bytes::Bytes;
use futures::stream::BoxStream;
use futures::StreamExt;
use reqwest::Client;
use std::time::Duration;

pub struct OllamaBackend {
    base_url: String,
    http: Client,
}

impl OllamaBackend {
    pub fn new(base_url: String) -> Self {
        let http = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .expect("build reqwest client");
        Self { base_url, http }
    }
}

#[async_trait]
impl InferenceBackend for OllamaBackend {
    fn name(&self) -> &'static str {
        "ollama"
    }

    async fn chat_completion(&self, req: &ChatRequest) -> Result<ChatCompletion> {
        let url = format!(
            "{}/v1/chat/completions",
            self.base_url.trim_end_matches('/')
        );
        let mut body = serde_json::to_value(req)?;
        // Ollama does not implement the OpenAI `stream=true` flag on the
        // non-streaming path, so we force it off here regardless of what
        // the caller sent.
        if let Some(obj) = body.as_object_mut() {
            obj.insert("stream".into(), serde_json::Value::Bool(false));
        }
        let resp = self
            .http
            .post(&url)
            .json(&body)
            .send()
            .await
            .with_context(|| format!("POST {}", url))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow!(
                "ollama chat completion failed ({}): {}",
                status,
                body
            ));
        }
        let out: ChatCompletion = resp.json().await.context("decode ollama response")?;
        Ok(out)
    }

    async fn chat_completion_stream(
        &self,
        req: &ChatRequest,
    ) -> Result<BoxStream<'static, Result<Bytes>>> {
        let url = format!(
            "{}/v1/chat/completions",
            self.base_url.trim_end_matches('/')
        );
        let mut body = serde_json::to_value(req)?;
        if let Some(obj) = body.as_object_mut() {
            obj.insert("stream".into(), serde_json::Value::Bool(true));
        }
        let http = self.http.clone();
        let stream = try_stream! {
            let resp = http
                .post(&url)
                .json(&body)
                .send()
                .await
                .with_context(|| format!("POST {}", url))?;
            let status = resp.status();
            let bytes_stream_result = if status.is_success() {
                Ok(resp.bytes_stream())
            } else {
                let text = resp.text().await.unwrap_or_default();
                Err(anyhow!("ollama stream failed ({}): {}", status, text))
            };
            let mut bytes_stream = bytes_stream_result?;
            while let Some(chunk) = bytes_stream.next().await {
                let chunk = chunk.context("read chunk from ollama")?;
                yield chunk;
            }
        };
        Ok(stream.boxed())
    }

    async fn embeddings(&self, req: &EmbeddingsRequest) -> Result<EmbeddingsResponse> {
        let url = format!("{}/v1/embeddings", self.base_url.trim_end_matches('/'));
        let resp = self
            .http
            .post(&url)
            .json(req)
            .send()
            .await
            .with_context(|| format!("POST {}", url))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow!("ollama embeddings failed ({}): {}", status, body));
        }
        let out: EmbeddingsResponse = resp.json().await.context("decode ollama embeddings")?;
        Ok(out)
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        let url = format!("{}/api/tags", self.base_url.trim_end_matches('/'));
        let resp = self
            .http
            .get(&url)
            .send()
            .await
            .with_context(|| format!("GET {}", url))?;
        if !resp.status().is_success() {
            return Ok(vec![]);
        }
        #[derive(Deserialize)]
        struct Tags {
            models: Vec<Model>,
        }
        #[derive(Deserialize)]
        struct Model {
            name: String,
        }
        let tags: Tags = resp.json().await.unwrap_or(Tags { models: vec![] });
        Ok(tags.models.into_iter().map(|m| m.name).collect())
    }
}
