//! Instruction handlers. Each submodule owns exactly one instruction plus its
//! Anchor `Accounts` context. `lib.rs` calls handlers through their fully-
//! qualified path (`instructions::foo::handler`); the glob re-exports below
//! surface the `Accounts` context types for use as `Context<T>` type
//! parameters. The multiple `handler` fn glob overlaps are expected and
//! silenced -- they are never referenced through the glob.

#![allow(ambiguous_glob_reexports)]

pub mod claim_reward;
pub mod initialize;
pub mod open_dispute;
pub mod register_model;
pub mod register_node;
pub mod resolve_dispute;
pub mod settle_inference;
pub mod slash_node;
pub mod stake;
pub mod submit_inference;
pub mod unstake;

pub use claim_reward::*;
pub use initialize::*;
pub use open_dispute::*;
pub use register_model::*;
pub use register_node::*;
pub use resolve_dispute::*;
pub use settle_inference::*;
pub use slash_node::*;
pub use stake::*;
pub use submit_inference::*;
pub use unstake::*;
