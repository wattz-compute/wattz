//! Routing subsystem.
//!
//! The routing engine is the meeting point between:
//! - **models_available** -- the set of models the Model Registry
//!   declares to be publishable at this time (fetched from the on-chain
//!   registry PDA).
//! - **nodes_online** -- the subset of registered GPU nodes that have
//!   passed recent health probes.
//!
//! The engine picks a node using a weighted score of price, latency,
//! and reputation and hands back a [`NodeSelection`] describing where
//! the gateway should proxy the request.

pub mod engine;
pub mod health;
pub mod node_pool;

pub use engine::{NodeSelection, RoutedTarget, RoutingEngine};
pub use node_pool::{NodeCapability, NodeSpec, NodePool};
