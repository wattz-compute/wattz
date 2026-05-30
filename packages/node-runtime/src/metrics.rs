//! Prometheus metrics for the node runtime.

use anyhow::Result;
use axum::response::IntoResponse;
use prometheus::{Encoder, IntCounter, Registry, TextEncoder};

pub struct MetricsRegistry {
    pub registry: Registry,
    pub requests_total: IntCounter,
    pub completed_total: IntCounter,
    pub heartbeat_success_total: IntCounter,
}

impl MetricsRegistry {
    pub fn new() -> Result<Self> {
        let registry = Registry::new();
        let requests_total =
            IntCounter::new("wattz_node_requests_total", "Total inference requests received")?;
        let completed_total = IntCounter::new(
            "wattz_node_completed_total",
            "Total inference requests completed successfully",
        )?;
        let heartbeat_success_total = IntCounter::new(
            "wattz_node_heartbeat_success_total",
            "Total heartbeats acknowledged by the gateway",
        )?;
        registry.register(Box::new(requests_total.clone()))?;
        registry.register(Box::new(completed_total.clone()))?;
        registry.register(Box::new(heartbeat_success_total.clone()))?;
        Ok(Self {
            registry,
            requests_total,
            completed_total,
            heartbeat_success_total,
        })
    }

    pub fn inc_requests(&self) {
        self.requests_total.inc();
    }

    pub fn inc_completed(&self) {
        self.completed_total.inc();
    }

    pub fn record_heartbeat_success(&self) {
        self.heartbeat_success_total.inc();
    }
}

pub async fn render(
    axum::extract::State(state): axum::extract::State<crate::state::NodeState>,
) -> impl IntoResponse {
    let mut buf = Vec::new();
    let encoder = TextEncoder::new();
    let metric_families = state.metrics.registry.gather();
    if let Err(err) = encoder.encode(&metric_families, &mut buf) {
        tracing::warn!(?err, "prometheus encode failed");
    }
    // TextEncoder::format_type returns a &'static str; we clone into an
    // owned String to satisfy the borrow checker even though the concrete
    // return is 'static.
    let content_type = TextEncoder::new().format_type().to_owned();
    ([(axum::http::header::CONTENT_TYPE, content_type)], buf)
}
