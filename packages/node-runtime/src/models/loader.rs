//! Model loader.
//!
//! Ollama pulls a model with `POST /api/pull` which returns a stream of
//! progress events. vLLM and TGI load their model at process start; the
//! loader for those backends only verifies that the requested model is the
//! one the backend is serving.

use anyhow::{anyhow, Context, Result};
use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;

use crate::config::Backend;

pub struct ModelLoader {
    kind: Backend,
    base_url: String,
    http: Client,
}

impl ModelLoader {
    pub fn new(kind: Backend, base_url: String) -> Self {
        Self {
            kind,
            base_url,
            http: Client::builder()
                .timeout(Duration::from_secs(60 * 30))
                .build()
                .expect("build reqwest client"),
        }
    }

    /// Ensure the model is available on the backend, pulling it if
    /// necessary. Returns the resolved model name (may differ from the
    /// requested name due to tag normalization).
    pub async fn ensure(&self, name: &str) -> Result<String> {
        match self.kind {
            Backend::Ollama => self.ensure_ollama(name).await,
            Backend::Vllm => self.ensure_vllm(name).await,
            Backend::Tgi => self.ensure_tgi(name).await,
        }
    }

    async fn ensure_ollama(&self, name: &str) -> Result<String> {
        let url = format!("{}/api/pull", self.base_url.trim_end_matches('/'));
        #[derive(serde::Serialize)]
        struct PullReq<'a> {
            name: &'a str,
            stream: bool,
        }
        let resp = self
            .http
            .post(&url)
            .json(&PullReq { name, stream: false })
            .send()
            .await
            .with_context(|| format!("POST {}", url))?;
        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("ollama pull failed ({}): {}", status, text));
        }
        Ok(name.to_string())
    }

    async fn ensure_vllm(&self, name: &str) -> Result<String> {
        // vLLM is single-model per process; verify it is serving the
        // requested one.
        let url = format!("{}/v1/models", self.base_url.trim_end_matches('/'));
        let resp = self
            .http
            .get(&url)
            .send()
            .await
            .with_context(|| format!("GET {}", url))?;
        if !resp.status().is_success() {
            return Err(anyhow!("vllm /v1/models returned {}", resp.status()));
        }
        #[derive(Deserialize)]
        struct Response {
            data: Vec<Model>,
        }
        #[derive(Deserialize)]
        struct Model {
            id: String,
        }
        let resp: Response = resp.json().await?;
        let ids: Vec<String> = resp.data.into_iter().map(|m| m.id).collect();
        if ids.iter().any(|id| id == name) {
            Ok(name.to_string())
        } else {
            Err(anyhow!(
                "vllm is serving {:?} but node requested {}",
                ids,
                name
            ))
        }
    }

    async fn ensure_tgi(&self, name: &str) -> Result<String> {
        let url = format!("{}/info", self.base_url.trim_end_matches('/'));
        let resp = self
            .http
            .get(&url)
            .send()
            .await
            .with_context(|| format!("GET {}", url))?;
        if !resp.status().is_success() {
            return Err(anyhow!("tgi /info returned {}", resp.status()));
        }
        #[derive(Deserialize)]
        struct Info {
            model_id: String,
        }
        let info: Info = resp.json().await?;
        if info.model_id == name {
            Ok(name.to_string())
        } else {
            Err(anyhow!(
                "tgi is serving {} but node requested {}",
                info.model_id,
                name
            ))
        }
    }
}
