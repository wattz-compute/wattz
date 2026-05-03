//! OpenAI request / response shapes.
//!
//! We deliberately keep the schema loose (`serde_json::Value` for
//! anything we do not touch) so that upstream nodes can pass through
//! new OpenAI fields without a gateway release.

use serde::{Deserialize, Serialize};
use serde_json::Value;

// ----- /v1/chat/completions -----

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    /// OpenAI allows `content: null` (function-call responses). We
    /// accept anything and forward it verbatim.
    #[serde(default)]
    pub content: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(default)]
    pub stream: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_completion_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub n: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub presence_penalty: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub frequency_penalty: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stop: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logit_bias: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tools: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_choice: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub response_format: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seed: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,
    /// Wattz-specific routing hint. Never forwarded to the node.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wattz_region: Option<String>,
    /// Wattz-specific minimum reputation gate. Never forwarded to node.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wattz_min_reputation: Option<f64>,
    /// Wattz-specific -- request commercial licensed model gating.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wattz_kyc_token: Option<String>,
}

impl ChatCompletionRequest {
    pub fn strip_wattz_extensions(mut self) -> Self {
        self.wattz_region = None;
        self.wattz_min_reputation = None;
        self.wattz_kyc_token = None;
        self
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatCompletionUsage {
    #[serde(default)]
    pub prompt_tokens: u32,
    #[serde(default)]
    pub completion_tokens: u32,
    #[serde(default)]
    pub total_tokens: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatCompletionChoice {
    pub index: u32,
    pub message: ChatMessage,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logprobs: Option<Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatCompletionResponse {
    pub id: String,
    #[serde(default = "default_object_kind")]
    pub object: String,
    pub created: i64,
    pub model: String,
    pub choices: Vec<ChatCompletionChoice>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub usage: Option<ChatCompletionUsage>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub system_fingerprint: Option<String>,
    /// Wattz augmentation -- node + attestation + settlement metadata.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wattz: Option<Value>,
}

fn default_object_kind() -> String {
    "chat.completion".to_string()
}

// ----- /v1/embeddings -----

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EmbeddingsRequest {
    pub model: String,
    pub input: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub encoding_format: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dimensions: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wattz_region: Option<String>,
}

impl EmbeddingsRequest {
    pub fn strip_wattz_extensions(mut self) -> Self {
        self.wattz_region = None;
        self
    }
}

// ----- /v1/images/generations -----

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ImageRequest {
    pub model: String,
    pub prompt: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub n: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub quality: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub response_format: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub style: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wattz_region: Option<String>,
}

impl ImageRequest {
    pub fn strip_wattz_extensions(mut self) -> Self {
        self.wattz_region = None;
        self
    }
}

// ----- /v1/models -----

#[derive(Clone, Debug, Serialize)]
pub struct ModelObject {
    pub id: String,
    #[serde(rename = "object")]
    pub object_kind: &'static str,
    pub created: i64,
    pub owned_by: String,
    // Wattz extensions.
    pub license: String,
    pub max_context: u32,
    pub kyc_required: bool,
    pub serving_nodes: usize,
}

#[derive(Clone, Debug, Serialize)]
pub struct ModelsList {
    pub object: &'static str,
    pub data: Vec<ModelObject>,
}
