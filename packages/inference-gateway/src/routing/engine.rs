//! Routing engine.
//!
//! Given a request (model, preferred region, minimum reputation) and
//! the current [`NodePool`], picks the best node using a weighted score:
//!
//! ```text
//! score = w_price   * (1 / (price_lamports_per_1k + 1))
//!       + w_latency * (1 / (latency_ms + 1))
//!       + w_reputation * reputation
//!       + region_bonus
//! ```
//!
//! Region preference is a soft nudge (not a filter) so a healthy far
//! node is picked over an unhealthy near node.

use super::node_pool::{NodePool, NodeSpec};
use crate::error::ApiError;
use crate::providers::{groq, GroqSelection};
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct NodeSelection {
    pub node_pubkey: String,
    pub http_endpoint: String,
    pub auth_token: Option<String>,
    pub region: String,
    pub price_per_1k_lamports: u64,
    pub reputation: f64,
    pub latency_ms: u64,
    pub score: f64,
    pub is_bootstrap_fallback: bool,
}

/// Which upstream (native Wattz node vs. external provider) the router
/// picked for a given request.
#[derive(Clone, Debug, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum RoutedTarget {
    Node(NodeSelection),
    Groq(GroqSelection),
}

pub struct RoutingEngine {
    pool: NodePool,
    weights: (f64, f64, f64),
    bootstrap_fallback: Option<NodeSpec>,
}

impl RoutingEngine {
    pub fn new(
        pool: NodePool,
        weights: (f64, f64, f64),
        bootstrap_fallback: Option<NodeSpec>,
    ) -> Self {
        Self {
            pool,
            weights,
            bootstrap_fallback,
        }
    }

    pub fn pool(&self) -> &NodePool {
        &self.pool
    }

    /// Pick the best node for `model`. Returns [`ApiError::NoNodeAvailable`]
    /// if no candidate is found, unless a bootstrap fallback exists.
    pub fn pick(
        &self,
        model: &str,
        preferred_region: Option<&str>,
        min_reputation: f64,
    ) -> Result<NodeSelection, ApiError> {
        let snapshot = self.pool.snapshot();
        let mut candidates: Vec<(&NodeSpec, f64)> = Vec::new();
        for node in &snapshot {
            if !node.healthy {
                continue;
            }
            if node.reputation < min_reputation {
                continue;
            }
            if !node.serves(model) {
                continue;
            }
            let price = node.price_for(model).unwrap_or(u64::MAX);
            let region_bonus = match preferred_region {
                Some(r) if r.eq_ignore_ascii_case(&node.region) => 0.2,
                _ => 0.0,
            };
            let (wp, wl, wr) = self.weights;
            let score = wp * (1.0 / (price as f64 + 1.0)) * 1_000_000.0
                + wl * (1.0 / (node.latency_ms as f64 + 1.0)) * 1_000.0
                + wr * node.reputation
                + region_bonus;
            candidates.push((node, score));
        }

        if let Some((node, score)) = candidates
            .into_iter()
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        {
            let price = node.price_for(model).unwrap_or(0);
            return Ok(NodeSelection {
                node_pubkey: node.node_pubkey.clone(),
                http_endpoint: node.http_endpoint.clone(),
                auth_token: node.auth_token.clone(),
                region: node.region.clone(),
                price_per_1k_lamports: price,
                reputation: node.reputation,
                latency_ms: node.latency_ms,
                score,
                is_bootstrap_fallback: node.bootstrap,
            });
        }

        // No candidate. Fall back to the bootstrap node if configured
        // -- it always exists and always serves the base model set.
        if let Some(b) = &self.bootstrap_fallback {
            tracing::warn!(
                model,
                "no registered node found, falling back to bootstrap node"
            );
            let price = b.price_for(model).unwrap_or(0);
            return Ok(NodeSelection {
                node_pubkey: b.node_pubkey.clone(),
                http_endpoint: b.http_endpoint.clone(),
                auth_token: b.auth_token.clone(),
                region: b.region.clone(),
                price_per_1k_lamports: price,
                reputation: b.reputation,
                latency_ms: b.latency_ms,
                score: 0.0,
                is_bootstrap_fallback: true,
            });
        }

        Err(ApiError::NoNodeAvailable(model.to_string()))
    }

    /// Same as [`pick`] but with awareness of the Groq fallback
    /// provider.
    ///
    /// Routing precedence:
    /// 1. If `groq_enabled` and the model is on Groq's preferred list,
    ///    the request is sent to Groq unconditionally -- Groq inference
    ///    for these open-weights models is an order of magnitude faster
    ///    than any Wattz node currently on the network.
    /// 2. Otherwise the normal [`pick`] path is tried first.
    /// 3. If the normal path yields [`ApiError::NoNodeAvailable`] and
    ///    Groq is enabled, the request falls back to Groq (bootstrap
    ///    resilience: the Playground always gets a live response even
    ///    when no bootstrap node is running).
    pub fn pick_with_groq(
        &self,
        model: &str,
        preferred_region: Option<&str>,
        min_reputation: f64,
        groq_enabled: bool,
    ) -> Result<RoutedTarget, ApiError> {
        if groq_enabled && groq::is_preferred(model) {
            return Ok(RoutedTarget::Groq(GroqSelection::new(model)));
        }
        match self.pick(model, preferred_region, min_reputation) {
            Ok(sel) => Ok(RoutedTarget::Node(sel)),
            Err(ApiError::NoNodeAvailable(_)) if groq_enabled && groq::can_serve(model) => {
                tracing::warn!(
                    model,
                    "no wattz node available; routing to groq fallback"
                );
                Ok(RoutedTarget::Groq(GroqSelection::new(model)))
            }
            Err(e) => Err(e),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::routing::node_pool::{NodeCapability, NodePool, NodeSpec};

    fn sample_node(pk: &str, price: u64, latency: u64, rep: f64, models: &[&str]) -> NodeSpec {
        NodeSpec {
            node_pubkey: pk.to_string(),
            http_endpoint: format!("http://{}.local:8081", pk),
            auth_token: None,
            region: "US-WEST".to_string(),
            capabilities: models
                .iter()
                .map(|m| NodeCapability {
                    model_id: m.to_string(),
                    price_per_1k_lamports: price,
                    max_context: 8192,
                    tee: true,
                })
                .collect(),
            reputation: rep,
            latency_ms: latency,
            healthy: true,
            bootstrap: false,
        }
    }

    #[test]
    fn picks_cheapest_when_weights_favor_price() {
        let pool = NodePool::new();
        pool.set(vec![
            sample_node("A", 500, 100, 0.7, &["llama-3-8b"]),
            sample_node("B", 200, 100, 0.7, &["llama-3-8b"]),
            sample_node("C", 200, 500, 0.9, &["llama-3-8b"]),
        ]);
        let engine = RoutingEngine::new(pool, (10.0, 0.1, 0.1), None);
        let pick = engine.pick("llama-3-8b", None, 0.0).unwrap();
        // B (200 lamports, 100ms latency) should win over A (500 lamports)
        // and over C (200 lamports but 500ms latency).
        assert_eq!(pick.node_pubkey, "B");
    }

    #[test]
    fn skips_unhealthy_nodes() {
        let pool = NodePool::new();
        let mut n = sample_node("BAD", 100, 10, 0.9, &["llama-3.1-8b-instant"]);
        n.healthy = false;
        pool.set(vec![n, sample_node("OK", 500, 200, 0.6, &["llama-3.1-8b-instant"])]);
        let engine = RoutingEngine::new(pool, (1.0, 1.0, 1.0), None);
        let pick = engine.pick("llama-3.1-8b-instant", None, 0.0).unwrap();
        assert_eq!(pick.node_pubkey, "OK");
    }

    #[test]
    fn falls_back_to_bootstrap() {
        let pool = NodePool::new();
        let bootstrap = NodeSpec {
            node_pubkey: "BOOT".to_string(),
            http_endpoint: "http://bootstrap.local:8081".to_string(),
            auth_token: None,
            region: "US-EAST".to_string(),
            capabilities: vec![NodeCapability {
                model_id: "llama-3-8b".to_string(),
                price_per_1k_lamports: 800,
                max_context: 4096,
                tee: false,
            }],
            reputation: 1.0,
            latency_ms: 40,
            healthy: true,
            bootstrap: true,
        };
        let engine = RoutingEngine::new(pool, (1.0, 1.0, 1.0), Some(bootstrap));
        let pick = engine.pick("llama-3-8b", None, 0.0).unwrap();
        assert!(pick.is_bootstrap_fallback);
        assert_eq!(pick.node_pubkey, "BOOT");
    }

    #[test]
    fn pick_with_groq_prefers_groq_for_llama() {
        let pool = NodePool::new();
        pool.set(vec![sample_node("A", 500, 100, 0.9, &["llama-3-8b"])]);
        let engine = RoutingEngine::new(pool, (1.0, 1.0, 1.0), None);
        let target = engine
            .pick_with_groq("llama-3-8b", None, 0.0, true)
            .unwrap();
        match target {
            RoutedTarget::Groq(sel) => {
                assert_eq!(sel.original_model, "llama-3-8b");
                assert_eq!(sel.groq_model, "llama-3.1-8b-instant");
            }
            RoutedTarget::Node(_) => panic!("expected groq route"),
        }
    }

    #[test]
    fn pick_with_groq_uses_nodes_for_non_groq_models() {
        let pool = NodePool::new();
        pool.set(vec![sample_node("A", 500, 100, 0.9, &["stable-diffusion-xl"])]);
        let engine = RoutingEngine::new(pool, (1.0, 1.0, 1.0), None);
        let target = engine
            .pick_with_groq("stable-diffusion-xl", None, 0.0, true)
            .unwrap();
        assert!(matches!(target, RoutedTarget::Node(_)));
    }

    #[test]
    fn pick_with_groq_falls_back_when_pool_empty() {
        let pool = NodePool::new();
        let engine = RoutingEngine::new(pool, (1.0, 1.0, 1.0), None);
        // Empty pool + relay-servable model => the request is served over
        // the Groq relay instead of erroring.
        let target = engine
            .pick_with_groq("llama-3.1-8b-instant", None, 0.0, true)
            .unwrap();
        assert!(matches!(target, RoutedTarget::Groq(_)));
    }

    #[test]
    fn pick_with_groq_errors_for_retired_model_even_when_enabled() {
        // Retired ids (mixtral) are neither preferred nor relay-servable,
        // so with an empty pool they must error rather than be advertised.
        let pool = NodePool::new();
        let engine = RoutingEngine::new(pool, (1.0, 1.0, 1.0), None);
        let err = engine
            .pick_with_groq("mixtral-8x7b", None, 0.0, true)
            .unwrap_err();
        assert!(matches!(err, ApiError::NoNodeAvailable(_)));
    }

    #[test]
    fn pick_with_groq_errors_when_disabled_and_pool_empty() {
        let pool = NodePool::new();
        let engine = RoutingEngine::new(pool, (1.0, 1.0, 1.0), None);
        let err = engine
            .pick_with_groq("mixtral-8x7b", None, 0.0, false)
            .unwrap_err();
        assert!(matches!(err, ApiError::NoNodeAvailable(_)));
    }
}
