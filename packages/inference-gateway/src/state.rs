//! Shared axum state. Concrete pool + registry hookups land later.

use anyhow::Result;

use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
}

impl AppState {
    pub async fn new(config: Config) -> Result<Self> {
        Ok(Self { config })
    }
}
