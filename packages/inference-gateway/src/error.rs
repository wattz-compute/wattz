//! Gateway-wide error type. Converts everything into an OpenAI-compatible
//! JSON error payload so SDK clients (Python `openai`, TypeScript `openai`)
//! can parse it without modification.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("no healthy node available for model {0}")]
    NoNodeAvailable(String),

    #[error("upstream node error: {0}")]
    Upstream(String),

    #[error("attestation verification failed: {0}")]
    AttestationFailed(String),

    #[error("settlement failed: {0}")]
    SettlementFailed(String),

    #[error("http client error: {0}")]
    Reqwest(#[from] reqwest::Error),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("internal error: {0}")]
    Internal(String),
}

impl ApiError {
    fn status(&self) -> StatusCode {
        match self {
            ApiError::BadRequest(_) => StatusCode::BAD_REQUEST,
            ApiError::NoNodeAvailable(_) => StatusCode::SERVICE_UNAVAILABLE,
            ApiError::Upstream(_) => StatusCode::BAD_GATEWAY,
            ApiError::AttestationFailed(_) => StatusCode::UNPROCESSABLE_ENTITY,
            ApiError::SettlementFailed(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ApiError::Reqwest(_) => StatusCode::BAD_GATEWAY,
            ApiError::Json(_) => StatusCode::BAD_REQUEST,
            ApiError::Io(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ApiError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_type(&self) -> &'static str {
        match self {
            ApiError::BadRequest(_) | ApiError::Json(_) => "invalid_request_error",
            ApiError::NoNodeAvailable(_) => "service_unavailable",
            ApiError::Upstream(_) | ApiError::Reqwest(_) => "upstream_error",
            ApiError::AttestationFailed(_) => "attestation_error",
            ApiError::SettlementFailed(_) => "settlement_error",
            ApiError::Io(_) | ApiError::Internal(_) => "internal_error",
        }
    }
}

#[derive(Serialize)]
struct OpenAiErrorBody<'a> {
    error: OpenAiErrorInner<'a>,
}

#[derive(Serialize)]
struct OpenAiErrorInner<'a> {
    message: String,
    #[serde(rename = "type")]
    error_type: &'a str,
    code: Option<&'a str>,
    param: Option<&'a str>,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.status();
        let error_type = self.error_type();
        let message = self.to_string();

        // Downgrade log level for expected client errors so ops does
        // not get paged on 4xx.
        if status.is_client_error() {
            tracing::debug!(%status, %error_type, %message, "client error");
        } else {
            tracing::error!(%status, %error_type, %message, "server error");
        }

        let body = OpenAiErrorBody {
            error: OpenAiErrorInner {
                message,
                error_type,
                code: None,
                param: None,
            },
        };
        (status, Json(body)).into_response()
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
