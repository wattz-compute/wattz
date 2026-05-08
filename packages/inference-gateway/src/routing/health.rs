//! Background health-check task.
//!
//! Iterates every node in the pool, hits `GET {endpoint}/healthz` with
//! a short timeout, and records the round-trip latency + status back
//! into the pool. Failing a probe twice in a row marks a node
//! unhealthy; a successful probe restores it immediately.

use super::node_pool::NodePool;
use reqwest::Client;
use std::time::{Duration, Instant};
use tokio::time::sleep;

pub struct HealthChecker {
    pool: NodePool,
    client: Client,
    interval: Duration,
}

impl HealthChecker {
    pub fn new(pool: NodePool, interval_secs: u64) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(5))
            .user_agent("wattz-inference-gateway/health-check/0.1")
            .build()
            .expect("reqwest client must build");
        Self {
            pool,
            client,
            interval: Duration::from_secs(interval_secs.max(5)),
        }
    }

    /// Run one health sweep across all nodes. Returns the number of
    /// nodes probed.
    pub async fn run_once(&self) -> usize {
        let snapshot = self.pool.snapshot();
        let count = snapshot.len();
        let futures = snapshot.into_iter().map(|node| {
            let client = self.client.clone();
            let pool = self.pool.clone();
            async move {
                let url = format!("{}/healthz", node.http_endpoint.trim_end_matches('/'));
                let start = Instant::now();
                let outcome = client.get(&url).send().await;
                let elapsed = start.elapsed().as_millis() as u64;
                match outcome {
                    Ok(r) if r.status().is_success() => {
                        pool.set_health(&node.node_pubkey, true, elapsed);
                    }
                    Ok(r) => {
                        tracing::warn!(
                            node = %node.node_pubkey,
                            status = r.status().as_u16(),
                            "node returned non-2xx on health probe"
                        );
                        pool.set_health(&node.node_pubkey, false, elapsed);
                    }
                    Err(err) => {
                        tracing::warn!(node = %node.node_pubkey, %err, "health probe failed");
                        pool.set_health(&node.node_pubkey, false, 0);
                    }
                }
            }
        });
        futures::future::join_all(futures).await;
        count
    }

    /// Spawn the periodic health-check loop.
    pub async fn run_forever(self) {
        loop {
            let n = self.run_once().await;
            tracing::debug!(count = n, "health sweep complete");
            sleep(self.interval).await;
        }
    }
}
