//! External provider integrations for the inference gateway.
//!
//! When the on-chain Model Registry advertises a model that the Wattz
//! node pool cannot yet serve (bootstrap phase, all nodes offline for a
//! particular model, or a model the routing engine has flagged as
//! `provider-preferred`), the gateway transparently proxies the request
//! to a fallback provider that already runs the same open-weights
//! model. Responses are re-labelled with the Wattz metadata block so
//! callers experience a consistent OpenAI-compatible surface regardless
//! of who actually did the compute.

pub mod groq;

pub use groq::{GroqProvider, GroqSelection};
