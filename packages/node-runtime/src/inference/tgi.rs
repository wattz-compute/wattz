//! HuggingFace Text Generation Inference (TGI) backend adapter.
//!
//! TGI 2.x exposes `/v1/chat/completions` at the standard OpenAI path
//! since the "OpenAI compatibility" release; older releases expose the
//! native `/generate` and `/generate_stream` endpoints. We support both
//! by preferring the OpenAI path and returning an actionable error if it
//! is unavailable.

use super::*;
use anyhow::{anyhow, Context};
use async_stream::try_stream;
use bytes::Bytes;
use futures::stream::BoxStream;
use futures::StreamExt;
use reqwest::Client;
use std::time::Duration;

pub struct TgiBackend {
    base_url: String,
    http: Client,
}

impl TgiBackend {
    pub fn new(base_url: String) -> Self {
        let http = Client::builder()
            .timeout(Duration::from_secs(300))
            .build()
            .expect("build reqwest client");
        Self { base_url, http }
    }
}

#[async_trait]
impl InferenceBackend for TgiBackend {
    fn name(&self) -> &'static str {
        "tgi"
    }

    async fn chat_completion(&self, req: &ChatRequest) -> Result<ChatCompletion> {
        let url = format!("{}/v1/chat/completions", self.base_url.trim_end_matches('/'));
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
            return Err(anyhow!("tgi chat completion failed ({}): {}", status, text));
        }
        let out: ChatCompletion = resp.json().await.context("decode tgi response")?;
        Ok(out)
    }

    async fn chat_completion_stream(
        &self,
        req: &ChatRequest,
    ) -> Result<BoxStream<'static, Result<Bytes>>> {
        let url = format!("{}/v1/chat/completions", self.base_url.trim_end_matches('/'));
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
                Err(anyhow!("tgi stream failed ({}): {}", status, text))
            };
            let mut chunks = chunks_result?;
            while let Some(chunk) = chunks.next().await {
                let chunk = chunk.context("read chunk from tgi")?;
                yield chunk;
            }
        };
        Ok(stream.boxed())
    }

    async fn embeddings(&self, req: &EmbeddingsRequest) -> Result<EmbeddingsResponse> {
        // TGI does not natively expose embeddings; some deployments run TEI
        // (Text Embedding Inference) side-car at the same base URL. We
        // attempt `/embed` (TEI native) then `/v1/embeddings` (OpenAI compat).
        let candidates = [
            format!("{}/v1/embeddings", self.base_url.trim_end_matches('/')),
            format!("{}/embed", self.base_url.trim_end_matches('/')),
        ];
        for url in candidates {
            let resp = self
                .http
                .post(&url)
                .json(req)
                .send()
                .await
                .with_context(|| format!("POST {}", url))?;
            if resp.status().is_success() {
                let out: EmbeddingsResponse = resp.json().await.context("decode tgi embeddings")?;
                return Ok(out);
            }
        }
        Err(anyhow!("tgi backend does not expose an embeddings endpoint"))
    }

    async fn list_models(&self) -> Result<Vec<String>> {
        let url = format!("{}/info", self.base_url.trim_end_matches('/'));
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
        struct Info {
            model_id: String,
        }
        let info: Info = resp
            .json()
            .await
            .unwrap_or(Info { model_id: String::new() });
        Ok(if info.model_id.is_empty() {
            vec![]
        } else {
            vec![info.model_id]
        })
    }
}
