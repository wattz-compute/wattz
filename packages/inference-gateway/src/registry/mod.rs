//! Model Registry client.
//!
//! The Model Registry is an Anchor program that stores a PDA of the
//! form:
//!
//! ```text
//! seed = ["wattz_registry"]  → registry_pda
//! ```
//!
//! containing a Borsh-serialized [`ModelRegistryAccount`]. Each entry
//! lists a model (id, hf_repo, license, ctx window) plus the on-chain
//! set of node keys currently publishing that model.
//!
//! On every request the gateway consults the in-memory cache populated
//! by the periodic refresh task.

pub mod client;

pub use client::{ModelEntry, ModelRegistryAccount, RegistryClient};
