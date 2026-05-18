//! Settlement subsystem.
//!
//! After every completed inference the gateway packs an
//! [`InferenceReceipt`] and submits it as an Anchor instruction on
//! Solana mainnet. The Anchor program credits the node with $WATTZ,
//! debits the caller, and stores the receipt for dispute resolution.

pub mod receipt;
pub mod submit;

pub use receipt::{InferenceReceipt, ReceiptInstructionArgs};
pub use submit::{SettlementClient, SettlementSummary};
