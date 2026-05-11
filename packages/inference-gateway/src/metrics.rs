//! Prometheus metrics.

use axum::{extract::State, http::header, response::IntoResponse};
use parking_lot::Mutex;
use prometheus::{
    HistogramOpts, HistogramVec, IntCounterVec, IntGauge, Opts, Registry, TextEncoder,
};
use std::sync::Arc;

use crate::state::AppState;

/// Reusable metrics container. Instantiated once inside [`AppState`].
#[derive(Clone)]
pub struct Metrics {
    pub registry: Arc<Mutex<Registry>>,
    pub requests_total: IntCounterVec,
    pub upstream_errors_total: IntCounterVec,
    pub attestation_total: IntCounterVec,
    pub settlement_total: IntCounterVec,
    pub inflight_requests: IntGauge,
    pub node_pool_size: IntGauge,
    pub healthy_nodes: IntGauge,
    pub request_latency: HistogramVec,
}

impl Metrics {
    pub fn new() -> Self {
        let registry = Registry::new();

        let requests_total = IntCounterVec::new(
            Opts::new(
                "wattz_gateway_requests_total",
                "Total inference requests processed by endpoint and outcome",
            ),
            &["endpoint", "outcome"],
        )
        .expect("valid counter opts");
        let upstream_errors_total = IntCounterVec::new(
            Opts::new(
                "wattz_gateway_upstream_errors_total",
                "Upstream node errors by node public key",
            ),
            &["node"],
        )
        .expect("valid counter opts");
        let attestation_total = IntCounterVec::new(
            Opts::new(
                "wattz_gateway_attestation_total",
                "Attestation outcomes by quote type and status",
            ),
            &["kind", "status"],
        )
        .expect("valid counter opts");
        let settlement_total = IntCounterVec::new(
            Opts::new(
                "wattz_gateway_settlement_total",
                "Anchor settlement outcomes",
            ),
            &["status"],
        )
        .expect("valid counter opts");
        let inflight_requests = IntGauge::new(
            "wattz_gateway_inflight_requests",
            "Currently inflight OpenAI requests",
        )
        .expect("gauge");
        let node_pool_size = IntGauge::new(
            "wattz_gateway_node_pool_size",
            "Number of nodes currently in the routing pool",
        )
        .expect("gauge");
        let healthy_nodes = IntGauge::new(
            "wattz_gateway_healthy_nodes",
            "Number of nodes currently marked healthy",
        )
        .expect("gauge");
        let request_latency = HistogramVec::new(
            HistogramOpts::new(
                "wattz_gateway_request_latency_seconds",
                "End-to-end inference latency (proxy + attestation + settlement)",
            )
            .buckets(vec![
                0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 20.0, 60.0,
            ]),
            &["endpoint"],
        )
        .expect("histogram");

        registry
            .register(Box::new(requests_total.clone()))
            .expect("register requests_total");
        registry
            .register(Box::new(upstream_errors_total.clone()))
            .expect("register upstream_errors_total");
        registry
            .register(Box::new(attestation_total.clone()))
            .expect("register attestation_total");
        registry
            .register(Box::new(settlement_total.clone()))
            .expect("register settlement_total");
        registry
            .register(Box::new(inflight_requests.clone()))
            .expect("register inflight");
        registry
            .register(Box::new(node_pool_size.clone()))
            .expect("register pool");
        registry
            .register(Box::new(healthy_nodes.clone()))
            .expect("register healthy");
        registry
            .register(Box::new(request_latency.clone()))
            .expect("register latency");

        Self {
            registry: Arc::new(Mutex::new(registry)),
            requests_total,
            upstream_errors_total,
            attestation_total,
            settlement_total,
            inflight_requests,
            node_pool_size,
            healthy_nodes,
            request_latency,
        }
    }
}

impl Default for Metrics {
    fn default() -> Self {
        Self::new()
    }
}

/// GET /metrics handler.
pub async fn render(State(state): State<AppState>) -> impl IntoResponse {
    let metrics = state.metrics.clone();
    metrics
        .node_pool_size
        .set(state.routing.pool().len() as i64);
    metrics
        .healthy_nodes
        .set(state.routing.pool().healthy_count() as i64);

    let encoder = TextEncoder::new();
    let registry = metrics.registry.lock();
    let metric_families = registry.gather();
    match encoder.encode_to_string(&metric_families) {
        Ok(body) => (
            axum::http::StatusCode::OK,
            [(header::CONTENT_TYPE, "text/plain; version=0.0.4")],
            body,
        ),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            [(header::CONTENT_TYPE, "text/plain")],
            format!("# metrics encoding failed: {}", e),
        ),
    }
}
