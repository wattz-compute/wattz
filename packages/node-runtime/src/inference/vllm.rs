//! vLLM backend adapter.
//!
//! vLLM's OpenAI-compatible server (`python -m vllm.entrypoints.openai.api_server`)
//! implements `/v1/chat/completions`, `/v1/completions`, `/v1/embeddings`,
//! and `/v1/models` at the standard OpenAI paths, which means the adapter
//! mostly forwards the request unchanged.

use super::*;
use anyhow::{anyhow, Context};
use async_stream::try_stream;
use bytes::Bytes;
use futures::stream::BoxStream;
use futures::StreamExt;
use reqwest::Client;
use std::time::Duration;

pub struct VllmBackend {
    base_url: String,
    http: Client,
}

impl VllmBackend {
    pub fn new(base_url: String) -> Self {
        let http = Client::builder()
            .timeout(Duration::from_secs(300))
            .build()
            .expect("build reqwest client");
        Self { base_url, http }
    }
}

#[async_trait]
impl InferenceBackend for VllmBackend {
    fn name(&self) -> &'static str {
        "vllm"
    }

    async fn chat_completion(&self, req: &ChatRequest) -> Result<ChatCompletion> {
        let url = format!(
            "{}/v1/chat/completions",
            self.base_url.trim_end_matches('/')
        );
        let mut body = serde_json::to_value(req)?;
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
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!(
                "vllm chat completion failed ({}): {}",
                status,
                text
            ));
        }
        let out: ChatCompletion = resp.json().await.context("decode vllm response")?;
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
            let chunks_result = if status.is_success() {
                Ok(resp.bytes_stream())
            } else {
                let text = resp.text().await.unwrap_or_default();
                Err(anyhow!("vllm stream failed ({}): {}", status, text))
            };
            let mut chunks = chunks_result?;
            while let Some(chunk) = chunks.next().await {
                let chunk = chunk.context("read chunk from vllm")?;
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
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("vllm embeddings failed ({}): {}", status, text));
        }
        let out: EmbeddingsResponse = resp.json().await.context("decode vllm embeddings")?;
        Ok(out)
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        let url = format!("{}/v1/models", self.base_url.trim_end_matches('/'));
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
        struct Response {
            data: Vec<Model>,
        }
        #[derive(Deserialize)]
        struct Model {
            id: String,
        }
        let out: Response = resp.json().await.unwrap_or(Response { data: vec![] });
        Ok(out.data.into_iter().map(|m| m.id).collect())
    }
}
