//! Gateway error type. `IntoResponse` is added in a follow-up.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum GatewayError {
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("upstream error: {0}")]
    Upstream(String),
    #[error("internal error: {0}")]
    Internal(String),
}
