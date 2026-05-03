//! OpenAI-compatible HTTP surface.
//!
//! Each submodule matches an OpenAI endpoint:
//! - `chat` -- `/v1/chat/completions` (streaming + non-streaming)
//! - `embeddings` -- `/v1/embeddings`
//! - `images` -- `/v1/images/generations`
//! - `models` -- `/v1/models`, `/healthz`, `/readyz`
//!
//! The `types` submodule holds shared request/response shapes.

pub mod chat;
pub mod embeddings;
pub mod images;
pub mod models;
pub mod types;
