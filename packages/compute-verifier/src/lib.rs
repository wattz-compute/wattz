//! Wattz compute verifier.
//!
//! This crate parses attestation reports and zero-knowledge receipts produced
//! by GPU nodes participating in the Wattz inference marketplace and verifies
//! the embedded cryptographic evidence.
//!
//! Two families of evidence are supported.
//!
//! * TEE attestation. Intel SGX DCAP quotes (`tee::sgx`), AMD SEV-SNP
//!   attestation reports (`tee::sev`) and NVIDIA Confidential Computing GPU
//!   attestation reports (`tee::nvidia_cc`).
//!
//! * Zero-knowledge receipts. Risc0 zkVM segment receipts (`zk::risc0`) and
//!   Succinct SP1 Groth16 / Plonk proofs (`zk::sp1`).
//!
//! The verifier performs the binary layout parsing prescribed by each vendor
//! specification and checks the embedded ECDSA / EdDSA signature against the
//! caller-supplied trust root. Full trust-chain verification against the
//! platform provisioning certificates (Intel PCS collateral, AMD ARK / ASK,
//! NVIDIA root) is out of scope of this crate: the caller is expected to
//! separately pin the trusted attestation key. This mirrors the shape of the
//! Wattz inference gateway which pins per-node attestation keys after an
//! out-of-band bootstrap flow.
//!
//! All parsing routines are hardened against short inputs and reject reports
//! that violate the canonical length constraints in the vendor specifications.

pub mod tee;
pub mod zk;

use thiserror::Error;

/// Common error type produced by every verifier in this crate.
#[derive(Debug, Error)]
pub enum VerifyError {
    #[error("input is too short: expected at least {expected} bytes, got {actual}")]
    Truncated { expected: usize, actual: usize },
    #[error("unsupported version: got {0}")]
    UnsupportedVersion(u32),
    #[error("unsupported attestation algorithm: got {0}")]
    UnsupportedAlgorithm(u32),
    #[error("invalid signature encoding")]
    InvalidSignatureEncoding,
    #[error("signature verification failed")]
    SignatureMismatch,
    #[error("report data mismatch: expected {expected}, got {actual}")]
    ReportDataMismatch { expected: String, actual: String },
    #[error("policy rejected: {0}")]
    Policy(&'static str),
    #[error("malformed report: {0}")]
    Malformed(&'static str),
}

/// Take exactly `n` bytes from the head of `slice` and return the remainder.
pub(crate) fn take<'a>(slice: &'a [u8], n: usize) -> Result<(&'a [u8], &'a [u8]), VerifyError> {
    if slice.len() < n {
        return Err(VerifyError::Truncated {
            expected: n,
            actual: slice.len(),
        });
    }
    Ok((&slice[..n], &slice[n..]))
}

pub(crate) fn read_u16_le(bytes: &[u8]) -> Result<u16, VerifyError> {
    let (head, _) = take(bytes, 2)?;
    Ok(u16::from_le_bytes([head[0], head[1]]))
}

pub(crate) fn read_u32_le(bytes: &[u8]) -> Result<u32, VerifyError> {
    let (head, _) = take(bytes, 4)?;
    Ok(u32::from_le_bytes([head[0], head[1], head[2], head[3]]))
}

pub(crate) fn read_u64_le(bytes: &[u8]) -> Result<u64, VerifyError> {
    let (head, _) = take(bytes, 8)?;
    let mut buf = [0u8; 8];
    buf.copy_from_slice(head);
    Ok(u64::from_le_bytes(buf))
}

/// Convenience re-export for external consumers.
pub use tee::sev::{verify_sev_snp_report, SevSnpClaims};
pub use tee::sgx::{verify_sgx_quote, SgxClaims};
pub use tee::nvidia_cc::{verify_nvidia_cc_quote, NvidiaCcClaims};
pub use zk::risc0::{verify_risc0_receipt, Risc0Claims};
pub use zk::sp1::{verify_sp1_proof, Sp1Claims};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn take_returns_head_and_tail() {
        let bytes = [1u8, 2, 3, 4, 5];
        let (head, tail) = take(&bytes, 2).unwrap();
        assert_eq!(head, &[1, 2]);
        assert_eq!(tail, &[3, 4, 5]);
    }

    #[test]
    fn take_truncated() {
        let bytes = [1u8, 2];
        assert!(matches!(
            take(&bytes, 3),
            Err(VerifyError::Truncated { expected: 3, actual: 2 })
        ));
    }

    #[test]
    fn read_little_endian_scalars() {
        let bytes = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08];
        assert_eq!(read_u16_le(&bytes).unwrap(), 0x0201);
        assert_eq!(read_u32_le(&bytes).unwrap(), 0x04030201);
        assert_eq!(read_u64_le(&bytes).unwrap(), 0x0807060504030201);
    }
}
