//! TEE attestation format verifiers.
//!
//! Every submodule follows the same shape: it exposes a `verify_*_quote` or
//! `verify_*_report` entrypoint that parses the wire format prescribed by the
//! vendor, verifies the embedded ECDSA signature against a caller-supplied
//! attestation public key, and returns a structured `*Claims` value that
//! captures the measurement, report data, TCB level, and any other fields
//! that the Wattz inference gateway needs for policy decisions.

pub mod nvidia_cc;
pub mod sev;
pub mod sgx;
