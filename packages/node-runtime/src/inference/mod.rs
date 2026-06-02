//! Backend inference clients.
//!
//! Each backend (Ollama, vLLM, TGI) implements the `InferenceBackend`
//! trait so the axum server layer can be backend-agnostic. All backends
//! expose OpenAI-compatible endpoints in production; the wrappers below
//! normalize their small differences (Ollama uses `/api/chat`, vLLM and
//! TGI expose `/v1/chat/completions`).

use anyhow::Result;
use async_trait::async_trait;
use bytes::Bytes;
use futures::stream::BoxStream;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub mod ollama;
pub mod tgi;
pub mod vllm;

use crate::config::Backend;

/// A normalized chat request. Mirrors the subset of the OpenAI schema that
/// every backend supports.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(default)]
    pub stream: bool,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub top_p: Option<f32>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatCompletion {
    pub id: String,
    pub object: String,
    pub created: i64,
    pub model: String,
    pub choices: Vec<ChatChoice>,
    pub usage: ChatUsage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatChoice {
    pub index: u32,
    pub message: ChatMessage,
    #[serde(default)]
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChatUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingsRequest {
    pub model: String,
    pub input: Value, // string or [string]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingsResponse {
    pub object: String,
    pub data: Vec<EmbeddingItem>,
    pub model: String,
    pub usage: ChatUsage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingItem {
    pub object: String,
    pub embedding: Vec<f32>,
    pub index: u32,
}

/// A backend able to serve OpenAI-compatible inference requests.
#[async_trait]
pub trait InferenceBackend: Send + Sync + 'static {
    async fn chat_completion(&self, req: &ChatRequest) -> Result<ChatCompletion>;

    async fn chat_completion_stream(
        &self,
        req: &ChatRequest,
    ) -> Result<BoxStream<'static, Result<Bytes>>>;

    async fn embeddings(&self, req: &EmbeddingsRequest) -> Result<EmbeddingsResponse>;

    /// Backend-specific list of loaded models. The result is merged with
    /// the configured model registry before it is returned to the caller.
    async fn list_models(&self) -> Result<Vec<String>>;

    fn name(&self) -> &'static str;
}

pub fn new_backend(kind: Backend, url: String) -> Result<Box<dyn InferenceBackend>> {
    Ok(match kind {
        Backend::Ollama => Box::new(ollama::OllamaBackend::new(url)),
        Backend::Vllm => Box::new(vllm::VllmBackend::new(url)),
        Backend::Tgi => Box::new(tgi::TgiBackend::new(url)),
    })
}
