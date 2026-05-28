//! Zero-knowledge receipt verifiers.
//!
//! The two zkVMs supported here are Risc0 (STARK-backed with an optional
//! Groth16 wrap) and Succinct SP1 (Groth16 or Plonk). Both zkVMs produce
//! a `Receipt` object whose top-level structure is a signed commitment to
//! the guest program output plus the underlying proof. This crate does
//! **not** re-implement the STARK verifier -- the raw STARK is passed
//! through to `risc0-zkvm` or `sp1-verifier` in production. Instead the
//! crate parses the wrapping envelope, checks that the commitment matches
//! the executed program (identified by `image_id` / `vk_hash`) and the
//! declared `journal` / `public_values` bytes, and verifies the signature
//! that the node uses to bind the receipt to its Solana pubkey (this is
//! how the Wattz inference gateway ensures that a receipt cannot be
//! replayed by a different node).

pub mod risc0;
pub mod sp1;
