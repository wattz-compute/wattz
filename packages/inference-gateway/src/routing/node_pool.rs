//! GPU node registry pool.
//!
//! The pool holds the union of:
//! - Nodes advertised on-chain via the node-runtime's `register_node`
//!   Anchor instruction (fetched lazily by the registry client).
//! - Nodes injected statically at boot via `WATTZ_STATIC_NODES` (used
//!   during the bootstrap phase before any node has staked).
//!
//! Each node is scored on the fly by the routing engine.

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// A single capability line advertised by a node. Each node may serve
/// multiple models at different price points.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NodeCapability {
    pub model_id: String,
    /// Price the node quotes per 1k output tokens, in lamports.
    pub price_per_1k_lamports: u64,
    /// Advertised context window.
    pub max_context: u32,
    /// Whether the node claims TEE attestation for this model.
    pub tee: bool,
}

/// A single GPU node available to the gateway.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NodeSpec {
    /// Base58 node public key (also the settlement destination).
    pub node_pubkey: String,
    /// HTTP endpoint exposing the OpenAI-compatible node runtime.
    pub http_endpoint: String,
    /// Optional bearer token to authenticate against the node.
    #[serde(default)]
    pub auth_token: Option<String>,
    /// ISO-3166 region code, used for regional preference.
    pub region: String,
    /// Advertised capabilities (models).
    pub capabilities: Vec<NodeCapability>,
    /// Node self-reported reputation (0.0-1.0). Overwritten by the
    /// registry client whenever it reads on-chain reputation.
    #[serde(default = "default_reputation")]
    pub reputation: f64,
    /// Measured round-trip latency in milliseconds. Zero means unknown.
    #[serde(default)]
    pub latency_ms: u64,
    /// Whether the most recent health probe succeeded.
    #[serde(default = "default_healthy")]
    pub healthy: bool,
    /// Whether this node is the always-online bootstrap node (used as
    /// a last-resort fallback).
    #[serde(default)]
    pub bootstrap: bool,
}

fn default_reputation() -> f64 {
    0.5
}
fn default_healthy() -> bool {
    true
}

impl NodeSpec {
    pub fn serves(&self, model: &str) -> bool {
        self.capabilities.iter().any(|c| c.model_id == model)
    }

    pub fn price_for(&self, model: &str) -> Option<u64> {
        self.capabilities
            .iter()
            .find(|c| c.model_id == model)
            .map(|c| c.price_per_1k_lamports)
    }
}

/// Thread-safe pool of nodes. Uses `parking_lot::RwLock` because reads
/// (routing decisions) far outnumber writes (registry / health updates).
#[derive(Clone)]
pub struct NodePool {
    inner: Arc<RwLock<Vec<NodeSpec>>>,
}

impl NodePool {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Overwrite the pool with a fresh snapshot (called by the registry
    /// refresh job).
    pub fn set(&self, nodes: Vec<NodeSpec>) {
        *self.inner.write() = nodes;
    }

    /// Return a cloned snapshot of the pool.
    pub fn snapshot(&self) -> Vec<NodeSpec> {
        self.inner.read().clone()
    }

    pub fn len(&self) -> usize {
        self.inner.read().len()
    }

    pub fn is_empty(&self) -> bool {
        self.inner.read().is_empty()
    }

    /// Merge / upsert a set of nodes by public key. Nodes already in
    /// the pool keep their measured `latency_ms` and `healthy` values.
    pub fn upsert_many(&self, incoming: Vec<NodeSpec>) {
        let mut w = self.inner.write();
        for node in incoming {
            match w.iter().position(|n| n.node_pubkey == node.node_pubkey) {
                Some(idx) => {
                    let existing = &mut w[idx];
                    existing.http_endpoint = node.http_endpoint;
                    existing.region = node.region;
                    existing.capabilities = node.capabilities;
                    existing.reputation = node.reputation;
                    existing.auth_token = node.auth_token;
                    // preserve health/latency measured locally
                }
                None => w.push(node),
            }
        }
    }

    /// Apply the outcome of a health probe.
    pub fn set_health(&self, node_pubkey: &str, healthy: bool, latency_ms: u64) {
        let mut w = self.inner.write();
        if let Some(n) = w.iter_mut().find(|n| n.node_pubkey == node_pubkey) {
            n.healthy = healthy;
            if latency_ms > 0 {
                n.latency_ms = latency_ms;
            }
        }
    }

    /// Number of nodes currently marked healthy.
    pub fn healthy_count(&self) -> usize {
        self.inner.read().iter().filter(|n| n.healthy).count()
    }
}

impl Default for NodePool {
    fn default() -> Self {
        Self::new()
    }
}
